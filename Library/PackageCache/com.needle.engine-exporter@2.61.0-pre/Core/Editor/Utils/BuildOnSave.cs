using JetBrains.Annotations;
using Needle.Engine.Core;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

namespace Needle.Engine.Utils
{
	[UsedImplicitly]
	internal class BuildOnSave
	{
		[InitializeOnLoadMethod]
		private static void InitializeBuildOnLoad()
		{
			EditorSceneManager.sceneSaved += OnSceneSave;
		}

		private static void OnSceneSave(Scene scene)
		{
			if (BuildPipeline.isBuildingPlayer) return;

			async void Action()
			{
				// if e.g. a user switches the scene and saves the old scene is not valid anymore
				// in that case we dont want to trigger a build
				if (scene.IsValid() && scene.isLoaded)
					await Builder.Build(true, BuildContext.LocalDevelopment);
			}

			EditorDelayedCall.RunDelayed(Action);
		}


		// private static void TryBuildReferencedScene()
		// {
		// 	if (ProjectsData.TryGetForActiveScene(out var info) && !string.IsNullOrEmpty(info.BuilderScene))
		// 	{
		// 		var path = AssetDatabase.GUIDToAssetPath(info.BuilderScene);
		// 		if (!string.IsNullOrEmpty(path)) OpenAndBuild(path);
		// 	}
		// }
		//
		// // TODO: refactor to just re-build current scene
		// private static async void OpenAndBuild(string scenePath)
		// {
		// 	var active = SceneManager.GetActiveScene();
		// 	var loaded = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Additive);
		// 	var exp = default(ExportInfo);
		// 	foreach (var rt in loaded.GetRootGameObjects())
		// 	{
		// 		if (exp) break;
		// 		exp = rt.GetComponentInChildren<ExportInfo>();
		// 	}
		// 	var info = BuildInfo.FromExportInfo(exp);
		// 	if (exp)
		// 	{
		// 		var activePath = active.path;
		// 		try
		// 		{
		// 			EditorSceneManager.CloseScene(active, true);
		// 			await Builder.Build(false, ExportType.Dev, -1, info);
		// 			EditorSceneManager.CloseScene(loaded, true);
		// 		}
		// 		finally
		// 		{
		// 			EditorSceneManager.OpenScene(activePath, OpenSceneMode.Single);
		// 		}
		// 	}
		// }
	}
}