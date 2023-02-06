using Needle.Engine.Core.References.ReferenceResolvers;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

#if UNITY_2020_3
using UnityEditor.Experimental.SceneManagement;
#endif

namespace Needle.Engine.Gltf
{
	internal static class EditorActions
	{
		internal static bool TryExportCurrentScene()
		{
			var scene = SceneManager.GetActiveScene();
			var asset = AssetDatabase.LoadAssetAtPath<SceneAsset>(scene.path) as Object;

			var prefabStage = PrefabStageUtility.GetCurrentPrefabStage();
			if (prefabStage)
			{
				asset = prefabStage.prefabContentsRoot;
			}

			if (asset)
			{
				GltfReferenceResolver.ClearCache();
				return Export.AsGlb(asset, out _, true);
			}
			return false;
		}
	}
}