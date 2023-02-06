using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Gltf;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using File = UnityEngine.Windows.File;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	// ReSharper disable once UnusedMember.Global
	internal static class ActionsBatch
	{
		// ReSharper disable once UnusedMember.Local
		private static async void Execute()
		{
			if (!Application.isBatchMode)
			{
				Debug.LogError("This method can only be called in batch mode!");
				return;
			}
			var success = true;
			var isDebugMode = false;
			EditorWindow consoleWindow = default;
			try
			{
				var args = Environment.GetCommandLineArgs();
				isDebugMode = args.Contains("-debug");
				if (isDebugMode)
					consoleWindow = TryOpenConsoleWindow();

				Debug.Log($"Begin commandline process");

				Task<bool> task = default;
				if (ProcessCommandLineArgs(args, out var cl))
				{
					task = Execute(cl);
				}

				if (task != null)
					success = await task;
				if (!success)
				{
					Debug.LogError("Run failed, see logs for details");
				}
				else
				{
					Debug.Log("Run succeeded");
				}
			}
			catch (Exception err)
			{
				Debug.LogException(err);
				success = false;
			}
			finally
			{
				if (isDebugMode)
				{
					if (!success)
					{
						Debug.Log("Run failed - Close the console window to exit the Editor");
						// ReSharper disable once LoopVariableIsNeverChangedInsideLoop
						while (consoleWindow)
						{
							await Task.Delay(1000);
						}
					}
					else
					{
						Debug.Log("Run finished - closing in 5 seconds");
						await Task.Delay(5000);
					}
				}
				Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, null, "Build batch finished, closing Editor");
				EditorApplication.Exit(success ? 0 : 1);
			}
		}


		// Example command:
		// path/to/Unity.exe -batchmode -projectPath "path/to/project" -executeMethod Needle.Engine.ActionsBatch.Execute -buildProduction -scene "Assets/path/to/scene.unity" 

		private const string availableCommandLineOptions = @"


> Needle Engine Commandline Options:
------------------------------
	-scene <path/to/scene_or_asset>		| open a specific scene or export a specific asset (e.g. path/to/myPrefab.prefab or path/to/myScene.unity)
	-buildProduction					| run a production build
	-buildDevelopment					| run a development build
	-outputPath <path/to/output.glb>	| set the output path for the build (only valid when building a scene)
	-debug								| open a console window for debugging
------------------------------


";
		
		private class CommandLineArgs
		{
			public string ScenePath;
			public bool BuildProduction;
			public bool BuildDevelopment;
			public string OutputPath;
			public bool Debug;
		}

		private static bool ProcessCommandLineArgs(string[] args, out CommandLineArgs res)
		{
			Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, null, $"Args: [{string.Join(", ", args)}]");
			Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, null, availableCommandLineOptions);
			res = new CommandLineArgs();
			for (var i = 0; i < args.Length; i++)
			{
				var arg = args[i];
				switch (arg)
				{
					case "-scene":
					{
						var scenePath = args[i + 1];
						res.ScenePath = scenePath;
						break;
					}
					case "-outputPath":
					{
						var path = args[i + 1];
						res.OutputPath = path;
						break;
					}
					case "-buildProduction":
						res.BuildProduction = true;
						break;
					case "-buildDevelopment":
						res.BuildDevelopment = true;
						break;
					case "-debug":
						res.Debug = true;
						break;
				}
			}
			
			return true;
		}

		private static async Task<bool> Execute(CommandLineArgs args)
		{
			if (!string.IsNullOrEmpty(args.ScenePath))
			{
				var scenePath = args.ScenePath;
				
				if (!File.Exists(scenePath)) Debug.LogError("File does not exist: " + scenePath);

				if (scenePath.EndsWith(".unity"))
				{
					var scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
					if (!scene.IsValid())
					{
						Debug.LogError("Scene is not valid: " + scenePath);
						return false;
					}
						
					if (args.BuildProduction)
						return await Actions.ExportAndBuildProduction();
					if (args.BuildDevelopment)
						return await Actions.ExportAndBuildDevelopment();
				}
				else
				{
					if (args.Debug)
					{
						// For debugging since export glb is blocking
						await Task.Delay(1000);
					}
					
					var production = args.BuildProduction;
					var outputPath = args.OutputPath;
					if (string.IsNullOrWhiteSpace(outputPath))
					{
						Debug.LogError("Missing output path for exporting asset as glb. Please provide a path/to/result.glb");
						return false;
					}
					var asset = AssetDatabase.LoadAssetAtPath<Object>(scenePath);
					var buildContext = BuildContext.Distribution(production);
					var dir = Path.GetDirectoryName(outputPath);
					var objectExportContext = new ObjectExportContext(buildContext, asset, dir, outputPath);
					Debug.Log("Running export " + scenePath);
					var res = Export.AsGlb(objectExportContext, asset, out _);
					if(!res) Debug.LogError("Exporting " + scenePath + " failed");
					else
					{
						Debug.Log($"Running compression ({(production ? "production" : "development")})");
						var outputDirectory = Path.GetDirectoryName(outputPath);
						res = await ActionsCompression.MakeProgressive(outputDirectory);
						res &= await ActionsCompression.CompressFiles(outputDirectory);
					}
					return res;
				}
			}
			
			Debug.LogError("Missing scene path. Please provide a path/to/scene.unity or path/to/asset");
			return false;
		}
		

		private static EditorWindow TryOpenConsoleWindow()
		{
			try
			{
				var consoleWindowType = typeof(EditorWindow).Assembly.GetType("UnityEditor.ConsoleWindow");
				var consoleWindow = ScriptableObject.CreateInstance(consoleWindowType) as EditorWindow;
				if (consoleWindow)
				{
					consoleWindow.Show(true);
					return consoleWindow;
				}
				
				Debug.LogError("Could not open console window");
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}

			return null;
		}
	}
}