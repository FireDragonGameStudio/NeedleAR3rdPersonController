using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using Needle.Engine.Writer;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	internal static class InternalActions
	{
		[MenuItem("CONTEXT/ComponentGenerator/Internal/Open CommandTester Window")]
		private static void DebugComponentCompilerCodegen(MenuCommand command)
		{
			var window = CommandTesterWindow.Create();
			window.command = "node component-compiler.js \"" + Path.GetFullPath(Application.dataPath + "/Needle/Components.codegen") + "\"" + " \"path/to/script.ts\"";
			window.directory = "Library/Needle/Sample/node_modules/@needle-tools/engine/node_modules/@needle-tools/needle-component-compiler/src";
		}
		
		[MenuItem(Constants.MenuItemRoot + "/Internal/Mark Types Dirty", priority = 7_000)]
		private static void MarkTypesDirty()
		{
			TypesUtils.MarkDirty();
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Compile Typescript", priority = 7_000)]
		private static async void CompileTypescript()
		{
			var exportInfo = Object.FindObjectOfType<ExportInfo>();
			if (exportInfo)
			{
				Debug.Log("Compile Typescript");
				var res = await ProcessHelper.RunCommand("tsc", Path.GetFullPath(exportInfo.GetProjectDirectory()));
				// Only run tsc in main project - otherwise we get errors because if peerDependencies
				// foreach (var dep in exportInfo.Dependencies)
				// {
				// 	if (dep.TryGetVersionOrPath(out var path))
				// 	{
				// 		Debug.Log("Compile dependency: " + dep.Name + " at " + path);
				// 		res &= await ProcessHelper.RunCommand("tsc", Path.GetFullPath(path));
				// 	}
				// }
				if (res) Debug.Log("Typescript compiled successfully");
				else Debug.LogError("Typescript compilation failed");
			}
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Has npm installed", priority = 7_000)]
		private static async void HasNpmInstalled()
		{
			if (!await Actions.HasNpmInstalled(true))
			{
				Debug.LogError(
					$"→ <b>Nodejs is not installed or could not be found</b> — please {"install nodejs".AsLink("https://nodejs.org")}\nRead more about using nodejs in Needle Engine: {Constants.DocumentationUrlNodejs}\n{string.Join("\n", ExporterProjectSettings.instance.npmSearchPathDirectories)}");
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
				Debug.Log("Please run `which npm` from your terminal and add the path in the settings to the additional search paths list.");
				// foreach(var line in ProcessHelper.RunCommandEnumerable("`which npm`"))
				// 	Debug.Log(line);
#endif
			}
			else Debug.Log("<b>Npm is installed.</b>".AsSuccess());
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Has vscode installed", priority = 7_000)]
		private static void HasVSCodeInstalled()
		{
			if (!Actions.HasVsCodeInstalled()) Debug.LogError("VSCode is not installed or could not be found. Please install VSCode.");
			else Debug.Log("<b>VSCode is installed.</b>".AsSuccess());
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Download VsCode", priority = 7_000)]
		private static async void DownloadVsCode()
		{
			await VsCodeHelper.DownloadAndInstallVSCode();
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Log npm path", priority = 7_000)]
		private static void LogNpmPath()
		{
			NpmUtils.LogPaths();
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Has Toktx installed", priority = 7_000)]
		private static async void HasToktxInstalled()
		{
			if (!await Actions.HasToktxInstalled())
			{
				Debug.LogError("Could not find toktx installation");
			}
			else
			{
				Debug.Log("<b>toktx is installed.</b>".AsSuccess());
				if (!Actions.HasMinimumToktxVersionInstalled())
				{
					Debug.LogWarning("Your toktx version is out of date. Please update to 4.1+ on " +
					                 "https://github.com/KhronosGroup/KTX-Software/releases".AsLink());
				}
			}
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Download Toktx", priority = 7_000)]
		internal static async void DownloadAndInstallToktx()
		{
			Debug.Log("Download toktx");
			var path = await ToktxUtils.DownloadToktx();
			if (File.Exists(path))
			{
				Debug.Log("Download toktx finished: " + path.AsLink());
				EditorUtility.RevealInFinder(path);
				try
				{
					Process.Start(path);
				}
				catch (Win32Exception ex)
				{
					if (ex.Message.Contains("canceled")) Debug.Log("Toktx installation cancelled");
					else Debug.LogException(ex);
				}
			}
			else
			{
				Debug.LogError("Failed downloading toktx");
			}
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/List node processes", priority = 7_000)]
		private static void ListNodeProcesses()
		{
			if (ProcessUtils.TryFindNodeProcesses(out var list))
			{
				Debug.Log("Found " + list.Count + " processes:");
				foreach (var proc in list)
				{
					Debug.Log(proc.Process.ProcessName + ", id=" + proc.Process.Id + ", command=\"" + proc.CommandLine + "\"");
				}
			}
			else Debug.Log("Did not find any node processes");
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Can build for production", priority = 7_000)]
		private static async void CanBuildForProduction()
		{
			var hasError = !await Actions.HasToktxInstalled();
			if (!hasError)
			{
				if (!Actions.HasMinimumToktxVersionInstalled())
				{
					Debug.LogError("Your toktx version is out of date. Please update to 4.1+ on " +
					               "https://github.com/KhronosGroup/KTX-Software/releases".AsLink());
				}
				else
				{
					LogHelpers.LogWithoutStacktrace(
						$"<b>{"Congrats".AsSuccess()}</b>, your machine ready to build for production and has all required dependencies installed!");
				}
			}
			else LogHelpers.LogWithoutStacktrace("Your machine is not setup to build for production. Please see error in console!");
		}

		internal static void LogFeedbackFormUrl()
		{
			Debug.Log(
				$"Please consider filling out the Beta Feedback form: {Constants.FeedbackFormUrl.AsLink()} — Thank you! ❤");
		}

		[MenuItem(Constants.MenuItemRoot + "/Internal/Delete vite caches", priority = 7_000)]
		private static void DeleteViteCaches()
		{
			if (Actions.HasStartedLocalServer())
			{
				Debug.LogWarning("Currently a local server is running - please stop the server before clearing vite caches");
				return;
			}
			var export = Object.FindObjectOfType<ExportInfo>(true);
			if (export)
			{
				ViteActions.DeleteCache(Path.GetFullPath(export.GetProjectDirectory()));
			}
			else Debug.LogWarning("No ExportInfo found");
		}

	}
}