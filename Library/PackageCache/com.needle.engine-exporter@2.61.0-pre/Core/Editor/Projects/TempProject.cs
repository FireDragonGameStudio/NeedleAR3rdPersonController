using System.Collections.Generic;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using EditorApplication = UnityEditor.EditorApplication;

namespace Needle.Engine.Projects
{
	[InitializeOnLoad]
	internal static class TempProject
	{
		static TempProject()
		{
			ExportInfo.RequestGeneratingTempProject += GenerateTempProject;
			CheckTempProjectsRequireInstallation();
			EditorSceneManager.activeSceneChangedInEditMode += OnChangedScene;
		}

		private static void OnChangedScene(Scene arg0, Scene arg1)
		{
			// wait at least a frame because if we create a new project from templates
			// it must have a chance to setup the project name
			EditorApplication.delayCall += CheckTempProjectsRequireInstallation;
		}

		private static bool isWaiting;

		private static async void CheckTempProjectsRequireInstallation()
		{
			if (isWaiting) return;
			isWaiting = true;
			do await Task.Delay(1000);
			while (EditorApplication.isCompiling || EditorApplication.isUpdating) ;
			isWaiting = false;
			var obj = Object.FindObjectOfType<ExportInfo>();
			if (obj && obj.IsTempProject() && !obj.IsInstalled() && obj.IsValidDirectory())
				GenerateTempProject(obj);
		}

		private static async void GenerateTempProject(IProjectInfo obj)
		{
			if (ProjectGenerator.Templates.Count > 0)
			{
				var template = ProjectGenerator.Templates[0];
				Debug.Log("Creating temporary project from " + template.name + " template at " + obj.ProjectDirectory.AsLink());
				var deps = (obj as ExportInfo)?.Dependencies;
				await ProjectGenerator.CreateFromTemplate(obj.ProjectDirectory, template, new ProjectGenerationOptions()
				{
					StartAfterGeneration = false,
					Dependencies = deps?.ToArray()
				});
			}
		}
	}
}