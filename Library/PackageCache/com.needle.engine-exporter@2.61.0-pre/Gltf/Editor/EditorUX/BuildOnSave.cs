using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.Core;
using UnityEditor;
using UnityEditor.Experimental;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

#if UNITY_2020_3
using UnityEditor.Experimental.SceneManagement;
#endif

namespace Needle.Engine.Gltf
{
	internal static class BuildOnSave
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorSceneManager.sceneSaved += OnSceneSave;
		}

		private static void OnSceneSave(Scene scene)
		{
			EditorApplication.delayCall += () =>
			{
				// dont export if a user switched the scene
				if (scene.IsValid() && scene.isLoaded && !Object.FindObjectOfType<ExportInfo>())
					EditorActions.TryExportCurrentScene();
			};
		}

		[UsedImplicitly]
		private class PrefabSaveWatcher : AssetsModifiedProcessor
		{
			private static string currentlyExportedPrefab;
			
			protected override void OnAssetsModified(string[] changedAssets, string[] addedAssets, string[] deletedAssets, AssetMoveInfo[] movedAssets)
			{
				if (changedAssets.Length <= 0) return;
				
				// This is just for exporting on save while in prefab mode
				if (PrefabStageUtility.GetCurrentPrefabStage() == null)
				{
					return;
				}

				if (currentlyExportedPrefab != null) return;
				if (Builder.IsBuilding) return;

				var exportInfo = Object.FindObjectOfType<ExportInfo>();
				if (!exportInfo) return;
				if (!exportInfo.AutoExport) return;
				
				foreach (var asset in changedAssets)
				{
					if (asset.EndsWith(".prefab"))
					{
						EditorApplication.delayCall += () =>
						{
							if (Builder.IsBuilding) return;
							currentlyExportedPrefab = asset;
							EditorActions.TryExportCurrentScene();
							currentlyExportedPrefab = null;
						};
						break;
					}
				}
			}
		}
	}
}