using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal static class ActionsBuild
	{
		// TODO: move all the deployment options to this class
		// refactor to take cancellation token and pass through process id for root cancellation

		internal static string GetBuildOutputDirectory(string projectDirectory)
		{
			if (NeedleProjectConfig.TryLoad(projectDirectory, out var config))
			{
				if (!string.IsNullOrWhiteSpace(config.buildDirectory))
					return projectDirectory + "/" + config.buildDirectory;
			}
			return projectDirectory + "/dist";
		}

		private static IBuildDistCallbackReceiver[] beforeBuildDistReceivers;

		internal static Task<bool> BeforeBuild(string projectDir)
		{
			if(PackageUtils.TryGetScripts(projectDir + "/package.json", out var scripts))
			{
				if(scripts.ContainsKey("pre-build"))
				{
					Debug.Log("Run pre-build script");
					return ProcessHelper.RunCommand("npm run pre-build", projectDir);
				}
				Debug.Log("Info: Add 'pre-build' script to your package.json to run it before building (For example to run 'tsc' to make sure your code compiles)".LowContrast());
			}
			return Task.FromResult(true);
		}

		internal static async Task<bool> InternalBuildDistTask(BuildContext buildContext, string projectDirectory = null, int buildProgressId = -1)
		{
			if (string.IsNullOrEmpty(projectDirectory))
				SceneExportUtils.IsValidExportScene(out projectDirectory, out _);

			if (string.IsNullOrEmpty(projectDirectory))
			{
				Debug.LogError("No project directory found");
				return false;
			}

			var dir = GetBuildOutputDirectory(projectDirectory);
			beforeBuildDistReceivers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IBuildDistCallbackReceiver>().ToArray();
			foreach (var b in beforeBuildDistReceivers)
			{
				await b.BeforeBuildDist(projectDirectory, dir);
			}
				
			var buildFileName = "build.log";
			var buildFilePath = projectDirectory + "/" + buildFileName;
			if (File.Exists(buildFileName)) File.Delete(buildFilePath);

			// this is for support of legacy vite template projects
			// newer projects will use a vite plugin to enable/disable gzip compression
			var useGzip = NeedleEngineBuildOptions.UseGzipCompression;
			ViteUtils.ChangeGzipCompression(projectDirectory, useGzip, out _);

			var scripts = GetScripts(projectDirectory);

			var cmd = GetBuildCommand(scripts, buildContext);

			if (buildProgressId >= 0) Progress.Report(buildProgressId, .5f, "Run build command: " + cmd);
			var success = await ProcessHelper.RunCommand(cmd, projectDirectory, buildFilePath, true, true, buildProgressId);

				
			if (success)
			{
				// compress resulting files
				if (buildProgressId >= 0) Progress.Report(buildProgressId, .9f, "Run compression command: " + cmd);
				if (!await HandleCompressionIfNecessary(projectDirectory, buildContext, scripts))
				{
					Debug.LogWarning("Failed to compress files in build directory");
					success = false;
				}
			}

			if (buildProgressId >= 0 && Progress.Exists(buildProgressId))
				Progress.Finish(buildProgressId);

			if (success)
			{
				if (Application.isBatchMode == false && buildContext.LiveUrl == null)
					Application.OpenURL(GetBuildOutputDirectory(projectDirectory));
			}
			return success;
		}

		public static string GetBuildCommand(Dictionary<string, string> scripts, BuildContext context)
		{
			var cmd = InternalGetBuildCommand(scripts, context, out var commandValue);
			if (cmd != null)
				cmd += GetBuildCommandArgs(context);

			cmd = $"npm run {cmd}";
			return cmd;
		}

		private static Dictionary<string, string> GetScripts(string projectDirectory)
		{
			if (PackageUtils.TryGetScripts(projectDirectory + "/package.json", out var scripts))
				return scripts;
			Debug.LogWarning("Failed reading scripts from package.json at " + projectDirectory);
			return null;
		}

		private static string InternalGetBuildCommand(Dictionary<string, string> scripts, BuildContext context, out string scriptCommand)
		{
			var scriptName = context.Command switch
			{
				BuildCommand.BuildProduction => "build:production",
				BuildCommand.BuildDev => "build:dev",
				BuildCommand.PrepareDeploy => "build:dev",
				_ => "build"
			};

			if (scripts != null)
			{
				// check if the package json contains one of our known script names
				if (scripts.TryGetValue(scriptName, out scriptCommand))
				{
					return scriptName;
				}

				// the package json has no known build command
				foreach (var kvp in scripts)
				{
					if (kvp.Key.IndexOf("build", StringComparison.OrdinalIgnoreCase) >= 0)
					{
						scriptCommand = kvp.Value;
						return kvp.Key;
					}
				}
			}

			scriptCommand = null;
			return scriptName;
		}

		private static string GetBuildCommandArgs(BuildContext context)
		{
#if UNITY_EDITOR_WIN
			if (context.ApplyGltfTextureCompression)
			{
				var installationLocation = ToktxUtils.GetToktxDefaultInstallationLocation();
				if (!string.IsNullOrWhiteSpace(installationLocation))
					return " --toktxPath \"" + installationLocation + "\"";
			}
#endif
			return "";
		}

		private static async Task<bool> HandleCompressionIfNecessary(string projectDirectory, BuildContext context, Dictionary<string, string> scripts)
		{
			if (context.Command == BuildCommand.BuildProduction)
			{
				if (NeedleProjectConfig.TryLoad(projectDirectory, out var config))
				{
					if (!string.IsNullOrWhiteSpace(config.buildDirectory))
					{
						var dir = projectDirectory + "/" + config.buildDirectory;
						if (Directory.Exists(dir))
						{
							Debug.Log("<b>Begin progressive</b> in " + dir);
							await ActionsCompression.MakeProgressive(dir);
							Debug.Log("<b>Begin compression</b> in " + dir);
							return await ActionsCompression.CompressFiles(dir);
						}

						Debug.LogError("Configured build directory does not exist. Please check the config file in your web project: \"" +
						               config.buildDirectory + "\"");
						return false;
					}
				}
			}

			return true;
		}
	}
}