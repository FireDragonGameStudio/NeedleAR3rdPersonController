using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using Unity.SharpZipLib.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	[CustomEditor(typeof(DeployToItch))]
	public class DeployToItchEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			base.OnInspectorGUI();

			if (buildIsInProgress)
			{
				EditorGUILayout.HelpBox("Build is in progress...", MessageType.Info);
			}

			using (new EditorGUI.DisabledScope(buildIsInProgress))
			{
				if (!buildIsInProgress)
				{
					EditorGUILayout.HelpBox("Clicking build will produce a zip which you can upload to itch.io as your HTML web project.", MessageType.None);
				}
				var devBuild = NeedleEngineBuildOptions.DevelopmentBuild;
				if (Event.current.modifiers == EventModifiers.Alt)
					devBuild = !devBuild;
				var postfix = devBuild ? "Dev" : "Prod";
				if (GUILayout.Button(new GUIContent("Build for Itch.io: " + postfix, "Click to build the itch.io zip from this project.\n\nHold ALT to quickly toggle between making a development build or a production build (files get compressed with toktx)"), GUILayout.Height(30)))
				{
					buildTask = PerformBuild(devBuild);
				}
			}
		}

		private static bool buildIsInProgress => buildTask != null && buildTask.IsCompleted == false;

		private static Task buildTask;
		
		private static async Task PerformBuild(bool devBuild)
		{
			var exportInfo = FindObjectOfType<ExportInfo>();
			if (!exportInfo)
			{
				Debug.LogError("Scene must contain Needle web project with a valid path but no " + nameof(ExportInfo) + " component was found.");
				return;
			}
			var projectDir = exportInfo.GetProjectDirectory();

			var foundCompression = ViteUtils.ChangeGzipCompression(projectDir, false, out var prevCompression);
			try
			{
				var task = devBuild ? Actions.ExportAndBuildDevelopment() : Actions.ExportAndBuildProduction();
				var res = await task;
				if (res)
				{
					var buildDirectory = ActionsBuild.GetBuildOutputDirectory(projectDir);
					var outputDir = Application.dataPath + "/../Temp/Needle/itch";
					Directory.CreateDirectory(outputDir);
					var outputPath = outputDir + "/" + new DirectoryInfo(projectDir).Name + ".zip";
					ZipUtility.CompressFolderToZip(outputPath, null, buildDirectory);
					EditorUtility.RevealInFinder(outputPath);
					Debug.Log($"<b>{"Successfully".AsSuccess()} built zip for itch.io</b>. You can upload this zip as your web project now: {outputPath.AsLink()}");
				}
			}
			finally
			{
				if (foundCompression && prevCompression)
				{
					ViteUtils.ChangeGzipCompression(projectDir, true, out _);
				}
			}
		}
	}
}