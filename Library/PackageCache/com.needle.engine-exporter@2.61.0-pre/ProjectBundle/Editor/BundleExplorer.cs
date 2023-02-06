using System.IO;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.ProjectBundle
{
	public class BundleExplorer : EditorWindow
	{
		[MenuItem(Engine.Constants.MenuItemRoot + "/Internal/NPM Definition Explorer (Internal)")]
		private static void Open()
		{
			var explorer = CreateInstance<BundleExplorer>();
			explorer.Show();
		}

		private void OnEnable()
		{
			titleContent = new GUIContent("NPM Definition Explorer");
		}

		private void OnGUI()
		{
			EditorGUILayout.LabelField("NpmDefs in Project", EditorStyles.boldLabel);
			GUILayout.Space(5);

			var project = Object.FindObjectOfType<ExportInfo>();
			var canInstall = project && project.Exists();
			var packageJsonPath = canInstall ? project.GetProjectDirectory() + "/package.json" : null;
			var nameColumnWidth = Screen.width * .3f;
			var middleWith = Screen.width * .4f;
			for (var index = 0; index < BundleRegistry.Instance.Bundles.Count; index++)
			{
				var bundle = BundleRegistry.Instance.Bundles[index];
				using (new EditorGUILayout.HorizontalScope())
				{
					var packageName = bundle.FindPackageName();
					var isDependency = PackageUtils.IsDependency(packageJsonPath, packageName);
					var isValid = bundle.IsValid();
					ColorScope colorScope = default;
					if (!isValid) colorScope = new ColorScope(new Color(.6f, .6f, .5f));

					EditorGUILayout.LabelField(new GUIContent(Assets.Icon), GUILayout.Width(16));
					GUILayout.Label(new GUIContent(Path.GetFileNameWithoutExtension(bundle.FilePath), bundle.FilePath), GUILayout.Width(nameColumnWidth));
					PingOnClick(bundle);
					using (new ColorScope(new Color(.7f, .7f, .7f)))
						EditorGUILayout.LabelField(new GUIContent(packageName, "Package name"), GUILayout.MaxWidth(middleWith));
					PingOnClick(bundle);
					colorScope?.Dispose();
					GUILayout.FlexibleSpace();
					using (new EditorGUI.DisabledScope(!canInstall || !isValid))
					{
						if (!isDependency)
						{
							if (GUILayout.Button(new GUIContent("Add", "Add"), GUILayout.Width(55)))
								bundle.Install();
						}
						else if (GUILayout.Button(new GUIContent("Remove", "Remove"), GUILayout.Width(55)))
							bundle.Uninstall();
					}
				}
			}

			void PingOnClick(Bundle bundle)
			{
				if (Event.current.type == EventType.MouseUp)
				{
					var lr = GUILayoutUtility.GetLastRect();
					if (lr.Contains(Event.current.mousePosition))
					{
						var asset = AssetDatabase.LoadMainAssetAtPath(bundle.FilePath);
						if (asset) EditorGUIUtility.PingObject(asset);
					}
				}
			}
		}
	}
}