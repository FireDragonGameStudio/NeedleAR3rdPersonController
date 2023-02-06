using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.VersionControl;
using UnityEngine;
using UnityEngine.UIElements;
using Task = System.Threading.Tasks.Task;

namespace Needle.Engine.Gltf.ImportSettings
{
	internal class AssetSettingsInspector : IMGUIContainer
	{
		private readonly struct AssetSettingsInspectorTarget
		{
			public readonly string rootSettingsPath;
			public readonly NeedleAssetSettings root;
			public readonly AssetSettings model;

			public AssetSettingsInspectorTarget(string rootSettingsPath, NeedleAssetSettings root, AssetSettings model)
			{
				this.rootSettingsPath = rootSettingsPath;
				this.root = root;
				this.model = model;
			}
		}

		private readonly List<AssetSettingsInspectorTarget> targets;
		private readonly SerializedObject serializedObject;

		public AssetSettingsInspector(Object[] targets)
		{
			this.targets = new List<AssetSettingsInspectorTarget>();

			for (var index = 0; index < targets.Length; index++)
			{
				var target = targets[index];
				var path = AssetDatabase.GetAssetPath(target);

				// Try to find the asset settings for this asset
				var existing = NeedleAssetSettings.Settings;
				var mainAsset = target;
				if (!AssetDatabase.IsMainAsset(mainAsset)) mainAsset = AssetDatabase.LoadMainAssetAtPath(path);
				var root = existing.FirstOrDefault(e => e.asset == mainAsset);
				string rootSettingsPath;
				if (root)
				{
					rootSettingsPath = AssetDatabase.GetAssetPath(root);
				}
				else
				{
					// Create a new asset settings for this asset
					rootSettingsPath = path + ".asset";
					if (!File.Exists(rootSettingsPath))
					{
						// we dont save them here to disc yet, only when the user edits the settings or exports them we want to apply them
						root = ScriptableObject.CreateInstance<NeedleAssetSettings>();
						root.Init(path);
					}
					else
					{
						root = AssetDatabase.LoadAssetAtPath<NeedleAssetSettings>(rootSettingsPath);
					}
				}

				if (root.TryGetAssetSettings(target, out var model))
				{
					this.targets.Add(new AssetSettingsInspectorTarget(rootSettingsPath, root, model));
				}
				else if(root.TryResolveMissing(target, out var resolved))
				{
					this.targets.Add(new AssetSettingsInspectorTarget(rootSettingsPath, root, resolved));
				}
			}

			if (this.targets.Count <= 0)
			{
				return;
			}
			var objects = this.targets.Select(t => t.model).ToArray() as Object[];
			serializedObject = new SerializedObject(objects);
			this.onGUIHandler += OnGUI;
		}

		private void OnGUI()
		{
			if (serializedObject != null)
			{
				const int rightMargin = 15;
				using var scope = new EditorGUI.ChangeCheckScope();
				// EditorGUI.indentLevel += 1;
				using var horizontal = new EditorGUILayout.HorizontalScope();
				GUILayout.Space(10);
				if (EditorGUILayoutAccess.BeginPlatformGrouping(rightMargin))
				{
					foreach (var target in targets)
					{
						var model = target.model;

						// check if we should draw custom gui
						var drawDefaultGUI = model.OnGUI();
						if (drawDefaultGUI)
						{
							var opts = new[] { GUILayout.Width(Mathf.CeilToInt(Screen.width - (rightMargin + 10))) };
							ComponentEditorUtils.DrawDefaultInspectorWithoutScriptField(serializedObject, null, opts);
						}

						break;
					}

					if (scope.changed && targets.Count > 0)
					{
						for (var index = 0; index < targets.Count; index++)
						{
							var target = targets[index];
							EditorUtility.SetDirty(target.model);

							if (index == 0)
							{
								EnsureAssetSettingsAssetExists(target);
							} 
							 
							// is multi edit?
							if (index >= 1)
							{
								var main = targets[0];
								var mainAsset = main.model;
								// var assetSetting = target.model;
								// we need to make sure we copy to the correct instance
								if (!main.root.TryGetAssetSettings(target.model.asset, out var assetSetting))
								{
									// It's possible that a user has selected multiple sub-assets from multiple assets
									if (target.root.asset != main.root.asset)
									{
										if (target.root.TryGetAssetSettings(target.model.asset, out assetSetting))
										{
											EnsureAssetSettingsAssetExists(target);
										}
									}
								}
								var asset = assetSetting!.asset;
								var id = assetSetting.identifier;
								EditorUtility.CopySerializedManagedFieldsOnly(mainAsset, assetSetting);
								assetSetting.asset = asset;
								assetSetting.identifier = id;
								EditorUtility.SetDirty(assetSetting);
							}
						}
						// AssetDatabase.ImportAsset(targets[0].rootSettingsPath);
						AssetDatabase.Refresh();
					}
				}
				else
				{
					using (new EditorGUI.DisabledScope(true))
						EditorGUILayout.LabelField("No compression options available for this platform");
				}
				EditorGUILayoutAccess.EndPlatformGrouping();
			}
		}

		private static void EnsureAssetSettingsAssetExists(AssetSettingsInspectorTarget target)
		{
			var root = target.root;
			var rootSettingsPath = target.rootSettingsPath;
			var isNewAsset = !EditorUtility.IsPersistent(root);
			if (isNewAsset)
			{
				AssetDatabase.CreateAsset(root, rootSettingsPath);
				root.OnSaved();
			}
			EditorUtility.SetDirty(root);
		}
	}
}