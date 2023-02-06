using System.Collections.Generic;
using System.IO;
using System.Linq;
using JetBrains.Annotations;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.SceneTemplate;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine.SceneTemplates
{
	/// <summary>
	/// Workaround for not being able to create a scene from an empty scene template (without dependencies) from immutable package
	/// </summary>
	[UsedImplicitly]
	internal class PostProcessNeedleTemplate : ISceneTemplatePipeline
	{
		public bool IsValidTemplateForInstantiation(SceneTemplateAsset sceneTemplateAsset) => true;

		private const string cloneWorkaroundPrefabName = "TemporaryClone-WorkaroundForCase-1421326";

		public void BeforeTemplateInstantiation(SceneTemplateAsset sceneTemplateAsset, bool isAdditive, string sceneName)
		{
			foreach (var dep in sceneTemplateAsset.dependencies)
			{
				if (dep.dependency?.name != cloneWorkaroundPrefabName)
					dep.instantiationMode = TemplateInstantiationMode.Reference;
			}
		}

		public void AfterTemplateInstantiation(SceneTemplateAsset sceneTemplateAsset, Scene scene, bool isAdditive, string sceneName)
		{
			_createdScenes.Add(scene);
			CleanUpSceneAfterInstantiation(scene);
			NameProject(scene);
			// this callback is called before the scene is actually saved with a new name
			EditorSceneManager.sceneSaving += OnSceneSaving;
			EditorSceneManager.MarkSceneDirty(scene);
			EditorSceneManager.SaveScene(scene);
			AssetDatabase.Refresh();

			var export = Object.FindObjectOfType<ExportInfo>();
			if (export)
			{
				Selection.activeObject = export;
				EditorGUIUtility.PingObject(export.gameObject);
			}
		}

		private static readonly List<Scene> _createdScenes = new List<Scene>();

		private static void OnSceneSaving(Scene scene, string path)
		{
			EditorSceneManager.sceneSaving -= OnSceneSaving;
			var registered = _createdScenes.FirstOrDefault(s => s == scene);
			if (registered.IsValid())
			{
				_createdScenes.Remove(registered);
				EditorApplication.delayCall += () =>
				{
					CleanUpSceneAfterInstantiation(scene, path);
					AssetDatabase.Refresh();
				};
			}
		}

		private static void CleanUpSceneAfterInstantiation(Scene scene, string scenePath = null)
		{
			if (scene.IsValid())
			{
				var gos = scene.GetRootGameObjects().FirstOrDefault(
					x => x.name == cloneWorkaroundPrefabName
				);
				if (gos)
				{
					var prefab = PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(gos);
					if (string.IsNullOrEmpty(prefab)) return;
					FileUtil.DeleteFileOrDirectory(prefab);
					FileUtil.DeleteFileOrDirectory(prefab + ".meta");
					Object.DestroyImmediate(gos);
				}
			}
			if (!string.IsNullOrEmpty(scenePath))
			{
				var folder = Path.GetFullPath(Path.GetDirectoryName(scenePath) + "\\" + Path.GetFileNameWithoutExtension(scenePath));
				if (Directory.Exists(folder) && Directory.GetFiles(folder).Length == 0)
				{
					FileUtil.DeleteFileOrDirectory(folder);
					FileUtil.DeleteFileOrDirectory(folder + ".meta");
				}
			}
		}

		private static void NameProject(Scene scene)
		{
			var project = scene.GetRootGameObjects();
			foreach (var go in project)
			{
				var info = go.GetComponentInChildren<ExportInfo>();
				if (!info) continue;
				info.CreateName(scene);
				return;
			}
		}
	}
}