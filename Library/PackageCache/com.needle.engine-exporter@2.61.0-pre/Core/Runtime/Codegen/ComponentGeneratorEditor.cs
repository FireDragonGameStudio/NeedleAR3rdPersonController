#if UNITY_EDITOR

using System.IO;
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Codegen
{
	[CustomEditor(typeof(ComponentGenerator))]
	public class ComponentGeneratorEditor : Editor
	{
		private ExportInfo exp = null;

		private void OnEnable()
		{
			var t = target as ComponentGenerator;
			if (!t) return;
			if (!t.TryGetComponent(out exp))
				exp = FindObjectOfType<ExportInfo>();
			
			t.UpdateWatcher();
		}

		public override void OnInspectorGUI()
		{
			if (!exp) return;
			if (!exp.Exists())
			{
				EditorGUILayout.HelpBox(
					"Generating components doesnt work without a project. Please create a project first in the " + nameof(ExportInfo) + " component.",
					MessageType.None);
				return;
			}
			base.OnInspectorGUI();
			var comp = target as ComponentGenerator;
			if (!comp) return;
			using (new EditorGUILayout.HorizontalScope())
			{
				comp.compilerDirectory = EditorGUILayout.TextField(
					new GUIContent(ObjectNames.NicifyVariableName(nameof(comp.compilerDirectory)), comp.compilerDirectory),
					comp.compilerDirectory);
				PathUtils.AddContextMenu(m =>
				{
					m.AddItem(new GUIContent("Open Directory"), false, () => Application.OpenURL(Path.GetFullPath(comp.compilerDirectory)));
				});
				if (GUILayout.Button("Select", GUILayout.Width(60), GUILayout.Height(19)))
				{
					var selectedPath = PathUtils.SelectPath("Select directory with component compiler", comp.compilerDirectory);
					if (Directory.Exists(selectedPath))
					{
						comp.compilerDirectory = PathUtils.MakeProjectRelative(selectedPath);
					}
					GUIUtility.ExitGUI();
				}
			}

			var missingInPackageJson = false;
			var isInstalled = true;
			var compilerFound = true;

			if (exp.Exists())
			{
				if (!Directory.Exists(comp.compilerDirectory))
				{
					isInstalled = false;
				}
				else if (!File.Exists(comp.FullCompilerPath))
				{
					compilerFound = false;
				}

				PackageUtils.TryReadDependencies(exp.PackageJsonPath, out var deps, "devDependencies");
				missingInPackageJson = !comp.TryFindCompilerDirectory(deps);

				if (missingInPackageJson)
				{
					EditorGUILayout.HelpBox("Compiler is no devDependency. Click the button below to add the package to " + exp.PackageJsonPath,
						MessageType.Warning,
						true);
				}
				else if (!isInstalled)
				{
					EditorGUILayout.HelpBox("Require install - please click install in the " + nameof(ExportInfo) + " component", MessageType.Warning, true);
				}
				else if (!compilerFound)
				{
					EditorGUILayout.HelpBox("Compiler file does not exist at " + Path.GetFullPath(comp.FullCompilerPath), MessageType.Warning, true);
				}

				if (missingInPackageJson)
				{
					if (GUILayout.Button("Add compiler package"))
					{
						deps.Add("@needle-tools/needle-component-compiler", "^1.0.0");
						PackageUtils.TryWriteDependencies(exp.PackageJsonPath, deps, "devDependencies");
					}
				}
				
				if(Path.IsPathRooted(comp.compilerDirectory) && Directory.Exists(comp.compilerDirectory))
					comp.compilerDirectory = PathUtils.MakeProjectRelative(comp.compilerDirectory);

				// if (isInstalled && compilerFound)
				// {
				// 	var dirs = comp.WatchedDirectories;
				// 	if (dirs.Length > 0)
				// 	{
				// 		var foldout = EditorGUILayout.Foldout(WatchedDirectoriesFoldout, "Watched Directories: " + dirs.Length);
				// 		WatchedDirectoriesFoldout = foldout;
				// 		if (foldout)
				// 		{
				// 			EditorGUI.indentLevel += 1;
				// 			var str = string.Join("\n", dirs.Select(PathUtils.MakeProjectRelative).Distinct());
				// 			EditorGUILayout.HelpBox("Watching:\n" + str, MessageType.None, true);
				// 			EditorGUI.indentLevel -= 1;
				// 		}
				// 	}
				// }

				var packageJsonPath = comp.compilerDirectory + "/../package.json";
				try
				{
					if (PackageUtils.TryGetVersion(packageJsonPath, out var version))
					{
						using (new ColorScope(new Color(.6f, .6f, .6f)))
						{
							EditorGUILayout.LabelField(new GUIContent("Installed version " + version, packageJsonPath));
							if (Event.current.type == EventType.ContextClick && GUILayoutUtility.GetLastRect().Contains(Event.current.mousePosition))
							{
								var menu = new GenericMenu();
								menu.AddItem(new GUIContent("Open Directory"), isInstalled, () => Application.OpenURL(Path.GetFullPath(comp.compilerDirectory)));
								var changelogPath = Path.GetFullPath(comp.compilerDirectory + "/../CHANGELOG.md");
								if (File.Exists(changelogPath))
									menu.AddItem(new GUIContent("Open Changelog"), false, () => EditorUtility.OpenWithDefaultApp(changelogPath));
								menu.AddItem(new GUIContent("Open on NPM"), false, () =>
								{
									Application.OpenURL("https://www.npmjs.com/package/@needle-tools/needle-component-compiler");
								});
								menu.ShowAsContext();
							}
						}
					}
				}
				catch (IOException)
				{
					// ignore, might happen on first install?!
				}

				if (!comp.FileWatcherIsActive)
				{
					EditorGUILayout.HelpBox("Watcher is inactive", MessageType.Warning);
					comp.UpdateWatcher();
				}
			}
		}

		private static bool WatchedDirectoriesFoldout
		{
			get => SessionState.GetBool("ComponentGen_WatchedDirectories", false);
			set => SessionState.SetBool("ComponentGen_WatchedDirectories", value);
		}
	}
}


#endif