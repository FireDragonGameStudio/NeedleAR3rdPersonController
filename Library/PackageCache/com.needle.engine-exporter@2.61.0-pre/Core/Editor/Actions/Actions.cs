using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Problems;
using Needle.Engine.Projects;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using Semver;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	public static class Actions
	{

		internal static Task<bool> buildTask;
		public static bool IsRunningBuildTask => buildTask != null && !buildTask.IsCompleted;

		public static void Play()
		{
			EnterPlayMode.Play();
		}

		public static void OpenNeedleExporterProjectSettings()
		{
			SettingsService.OpenProjectSettings("Project/Needle");
		}

		/// <summary>
		/// For full re-export, making sure all types are collected again, smart export asset hashes are cleared and the cache directory is deleted
		/// </summary>
		public static void ClearCaches(ExportInfo exp = null)
		{
			TypesUtils.MarkDirty();
			AssetDependency.ClearCaches(); 
			
			if (!exp)
			{
				exp = Object.FindObjectOfType<ExportInfo>();
				if (!exp) return;
			}
			
			var cacheDir = ProjectInfoExtensions.GetCacheDirectory();
			if (Directory.Exists(cacheDir))
			{
				Debug.Log("Delete caches: " + cacheDir);
				Directory.Delete(cacheDir, true);
			}
		}

		public static Task<bool> ExportAndBuild(bool dev)
		{
			return MenuItems.BuildForDistAsync(dev ? BuildContext.Development : BuildContext.Production );
		}

		public static Task<bool> ExportAndBuild(BuildContext context)
		{
			return MenuItems.BuildForDistAsync(context);
		}

		public static Task<bool> ExportAndBuildDevelopment()
		{
			return MenuItems.BuildForDistAsync(BuildContext.Development);
		}

		public static Task<bool> ExportAndBuildProduction()
		{
			return MenuItems.BuildForDistAsync(BuildContext.Production);
		}

		public static Task<bool> BuildDist(BuildContext context)
		{
			return ActionsBuild.InternalBuildDistTask(context);
		}

		public static Task<bool> BuildDevelopmentDist()
		{
			return ActionsBuild.InternalBuildDistTask(BuildContext.Development);
		}

		public static Task<bool> BuildProductionDist()
		{
			return ActionsBuild.InternalBuildDistTask(BuildContext.Production);
		}

		public static void StartLocalServer() => MenuItems.StartDevelopmentServer();

		public static bool HasStartedLocalServer() => ProgressHelper.GetStartedAndRunningProcesses(p => p.IsThisProject()).Any();

		public static void StopLocalServer()
		{
			var killedAny = false;
			foreach (var proc in ProgressHelper.GetStartedAndRunningProcesses(p => p.IsThisProject()))
			{
				killedAny = true;
				proc.Kill();
			}
			if (killedAny)
				ProgressHelper.UpdateStartedProcessesList();
		}

		public static async void TestValidInstallation(bool logToConsole = false)
		{
			// if the server is not running it might be because npm is not installed
			// run npm just to print out possibly errors
			if (!await ProcessHelper.RunCommand("npm", null, null, true, logToConsole))
			{
				Debug.LogError(
					$"→ <b>Nodejs is not installed or could not be found</b> — please {"install nodejs".AsLink("https://nodejs.org")}\nRead more about using nodejs in Needle Engine: {Constants.DocumentationUrlNodejs}\n{string.Join("\n", ExporterProjectSettings.instance.npmSearchPathDirectories)}");
#if UNITY_EDITOR_OSX || UNITY_STANDALONE_OSX
				Debug.Log("Please run `which npm` from your terminal and add the path in the settings to the additional search paths list.");
#endif
			}
		}

		public static async Task<bool> HasToktxInstalled()
		{
			var cmd = "toktx --version";
			ToktxUtils.SetToktxCommandPathVariable(ref cmd);
			var isError = ProcessHelper.RunCommandEnumerable(cmd).Any(l => l.Contains("'toktx' is not recognized"));
			if (isError)
			{
				var msg =
					$"→ <b>toktx is not installed</b> — but it is required for production builds. Visit {"https://github.com/KhronosGroup/KTX-Software/releases".AsLink()} and download and install the latest version.";
#if UNITY_EDITOR_WIN
				msg += "\nMake sure to enable add to PATH in the installer!";
#endif
				msg += "\n" + cmd;
				Debug.LogError(msg);
				return false;
			}

			await Task.CompletedTask;
			return true;
		}

		public static bool HasMinimumToktxVersionInstalled()
		{
			var cmd = "toktx --version";
			ToktxUtils.SetToktxCommandPathVariable(ref cmd);
			foreach (var line in ProcessHelper.RunCommandEnumerable(cmd))
			{
				if (line == null) continue;
				if (line.StartsWith("toktx v4.0")) return false;
				if (line.StartsWith("toktx v")) return true;
			}
			return false;
		}

		public static async Task<bool> HasNpmInstalled(bool logToConsole = false)
		{
			return await ProcessHelper.RunCommand("npm --version", null, null, true, logToConsole);
		}

		public static bool HasVsCodeInstalled()
		{
			#if UNITY_EDITOR_OSX
			return File.Exists("/Applications/Visual Studio Code.app/Contents/MacOS/Electron");
			#else
			foreach (var line in ProcessHelper.RunCommandEnumerable("code --version"))
			{
				if (SemVersion.TryParse(line, SemVersionStyles.Any, out _)) return true;
			}
			#endif
			return false;
		}

		/// <summary>
		/// Requires global typescript installation
		/// </summary>
		internal static Task<bool> TryCompileTypescript(string projectDirectory)
		{
			// Note: this requires global typescript installation
			return ProcessHelper.RunCommand("tsc -noEmit", projectDirectory);
		}

		public static bool IsInExportScene() => Object.FindObjectOfType<ExportInfo>();

		public static async Task<bool> InstallCurrentProject(bool showWindow = false)
		{
			if (SceneExportUtils.IsValidExportScene(out var path, out _))
			{
				EnsureDependenciesAreAddedToPackageJson();
				
				var packageJsonPath = path + "/package.json";
				if (ProjectValidator.FindProblems(packageJsonPath, out var problems))
				{
					if (!await ProblemSolver.TryFixProblems(path, problems))
					{
						Debug.LogError("Can not build because package.json has problems. Please fix errors listed below first:",
							Object.FindObjectOfType<ExportInfo>());
						foreach (var p in problems)
						{
							Debug.LogFormat(LogType.Error, LogOption.NoStacktrace, null, "{0}: {1}", p.Id, p.Message);
						}
						return false;
					}
				}
				if (File.Exists(packageJsonPath)) await ProjectGenerator.ReplaceVariables(packageJsonPath);
				await ActionsHelperPackage.UpdateThreeTypes(path);
				var res = await RunNpmInstallAtPath(path, showWindow);
				if (res) TypesUtils.MarkDirty();
				return res;
			}
			
			// don't log if we don't know for what
			if (!string.IsNullOrEmpty(path))
				Debug.LogWarning("Can not install - no valid project path found. Does the project exist? " + path.AsLink());
			
			return false;
		}

		public static void EnsureDependenciesAreAddedToPackageJson(ExportInfo exportInfo = null)
		{
			if(!exportInfo)
				exportInfo = Object.FindObjectOfType<ExportInfo>();
			var packageJsonPath = Path.GetFullPath(exportInfo.PackageJsonPath);
			foreach (var dep in exportInfo.Dependencies)
			{
				dep.Install(packageJsonPath);
			}
		}

		public static async Task<bool> InstallPackage(bool clean, bool showWindow = false)
		{
			try
			{
				// install local package dependencies
				var modulePathForLocalInstallation = ProjectPaths.NpmPackageDirectory;

				if (clean)
				{
					if (!EditorUtility.DisplayDialog("Clean installation",
						    "You are about to run clean install - this will delete node_module folders and package-lock files as well as shut down running node processes. Do you want to continue?",
						    "Yes, perform clean install", "No cancel"))
					{
						Debug.LogWarning("Clean install cancelled");
						return false;
					}

					var running = ProgressHelper.GetStartedAndRunningProcesses().ToArray();
					foreach (var proc in running) proc.Kill();
					ProcessUtils.KillNodeProcesses(null);

					// delete node modules and package lock of installed needle package
					await DeleteDirectory(modulePathForLocalInstallation, "node_modules");
					var packagePackageLock = modulePathForLocalInstallation + "/package-lock.json";
					if (File.Exists(packagePackageLock)) File.Delete(packagePackageLock);

					// delete of current projec
					var exp = Object.FindObjectOfType<ExportInfo>();
					var dir = exp.GetProjectDirectory();
					await DeleteDirectory(dir, "node_modules");
					var lockFile = dir + "/package-lock.json";
					if (File.Exists(lockFile)) File.Delete(lockFile);

					Debug.Log("Run npm update - this might take a while...");
					await ProcessHelper.RunCommand("npm update", dir);
				}

				var success = true;
				if (!string.IsNullOrEmpty(modulePathForLocalInstallation) && Directory.Exists(modulePathForLocalInstallation))
				{
					success &= await RunNpmInstallAtPath(modulePathForLocalInstallation, showWindow);
				}
				else
				{
					Debug.LogWarning("Can not install js package, module not found at \"" + modulePathForLocalInstallation +
					                 "\". Please open \"ProjectSettings/Needle/threejs Exporter\" and make sure you entered valid paths to the js module package location.");
				}

				success &= await InstallCurrentProject(showWindow);

				// this is necessary to reload types after modules installation
				TypesUtils.MarkDirty();

				if (success)
					Debug.Log("<b>Install finished</b>");
				else
				{
					Debug.LogWarning("<b>Installation did not succeed</b> - please see logs for errors or problems");
				}
				return success;
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}
			return false;
		}

		private static Task<bool> DeleteDirectory(string dir, string name)
		{
#if UNITY_EDITOR_WIN
			// /Q is quiet mode, /s is subdirectories/files
			return ProcessHelper.RunCommand("rmdir /s /Q " + name, dir);
#else
			return ProcessHelper.RunCommand("rm -rf " + name, dir);
#endif
		}

		public static bool IsInstalling()
		{
			return installationTasks.Count > 0 && installationTasks.Values.Any(t => !t.task.IsCompleted);
		}

		public static async Task<bool> WaitForInstallationToFinish()
		{
			var t = installationTasks.Values.FirstOrDefault(t => !t.task.IsCompleted);
			if (t.task != null)
			{
				var res = await t.task;
				return res;
			}
			return true;
		}

		private static readonly Dictionary<string, (Task<bool> task, DateTime startTime)> installationTasks =
			new Dictionary<string, (Task<bool> task, DateTime startTime)>();

		internal static Task<bool> RunNpmInstallAtPath(string path, bool showWindow)
		{
			path = Path.GetFullPath(path);
			if (installationTasks.TryGetValue(path, out var t))
			{
				if (t.task.IsCompleted) installationTasks.Remove(path);
				else return t.task;
			}

			var logPrefix = "Installing: npm install";
			Debug.Log($"<b>{logPrefix}</b> at <a href=\"{path}\">{path}</a>");
			if (!DriveHelper.HasEnoughAvailableDiscSpace(path, 200))
			{
				Debug.LogWarning(
					"<b>It looks like you dont have enough disc space available!</b> Make sure you have at least 200 mb or more, otherwise installation might not be able to finish!");
				return Task.FromResult(false);
			}
			var noWindow = !showWindow;
			var cmd = NpmCommands.SetDefaultNpmRegistry;
			cmd += $" && " + NpmUtils.GetInstallCommand() + " --force";
			if (showWindow) cmd += " && timeout 5";
			// for some reason std output does sometimes only output stuff when the process has already ended
			var logFilePath = Application.dataPath + "/../Temp/NeedleTinyCmdProcess.log";
			var info = new TaskProcessInfo(path, cmd);
			var task = ProcessHelper.RunCommand(cmd, path, logFilePath, noWindow, true);
			installationTasks.Add(path, (task, DateTime.Now));
			WatchInstallationTask(path, task, info);
			return task;
		}

		private static async void WatchInstallationTask(string directory, IAsyncResult task, TaskProcessInfo info)
		{
			var startTime = DateTime.Now;
			var unexpectedLongTime = TimeSpan.FromMinutes(5);
			var packageJsonLockPath = directory + "/package-lock.json";
			while (task != null && !task.IsCompleted)
			{
				if (DateTime.Now - startTime > unexpectedLongTime)
				{
					if (File.Exists(packageJsonLockPath))
					{
						if (EditorUtility.DisplayDialog("Installation is taking longer than expected",
							    $"npm installation in {directory} takes longer than expected. You might need to delete the package-lock.json and retry.",
							    "Delete package-lock.json now", "Continue waiting"))
						{
							File.Delete(packageJsonLockPath);
							ProcessHelper.CancelTask(info);
							Debug.Log("Deleted package-lock.json. Please try restarting installation.", Object.FindObjectOfType<ExportInfo>());
						}
						break;
					}
				}
				await Task.Delay(20_000);
			}
		}

		[Flags]
		internal enum PathType
		{
			NeedleRuntimePackage = 0,
			LocalThreejs = 1
		}


		private static Task<bool> _projectSetupTask;
		internal static bool ProjectSetupIsRunning => _projectSetupTask != null && !_projectSetupTask.IsCompleted;

		internal static void RunProjectSetupIfNecessary()
		{
			var settings = ExporterProjectSettings.instance;
			PathType type = default;
			if (string.IsNullOrEmpty(settings.localRuntimePackage))
				type |= PathType.NeedleRuntimePackage;
			if(string.IsNullOrEmpty(settings.localThreejsPackage))
				type |= PathType.LocalThreejs;
			RunProjectSetup(type, false);
		}

		internal static Task<bool> RunProjectSetup(PathType type = PathType.LocalThreejs | PathType.NeedleRuntimePackage,
			bool runInstall = false)
		{
			if (ProjectSetupIsRunning) return _projectSetupTask;
			_projectSetupTask = OnRunProjectSetup(type, runInstall);
			return _projectSetupTask;
		}

		internal static bool LocalPackagesAreInstalled()
		{
			var path = Path.GetFullPath("Packages/" + Constants.RuntimeUnityPackageName) + "/package~/node_modules";
			if (!Directory.Exists(path)) return false;
			return true;
		}

		private static async Task<bool> OnRunProjectSetup(PathType type, bool runInstall)
		{
			var settings = ExporterProjectSettings.instance;
			var packagePath = Path.GetFullPath("Packages/" + Constants.RuntimeUnityPackageName);
			var foundAll = true;
			var runtimePackagePath = default(string);

			if (type.HasFlag(PathType.NeedleRuntimePackage))
			{
				var localPath = packagePath + "/package~";
				if (Directory.Exists(localPath))
				{
					runtimePackagePath = localPath;
					settings.localRuntimePackage = PathUtils.MakeProjectRelative(localPath);
					settings.Save();

					var modulesDir = localPath + "/node_modules";
					if (runInstall || !Directory.Exists(modulesDir) || Directory.GetFileSystemEntries(modulesDir).Length <= 0)
					{
						await RunNpmInstallAtPath(localPath, false);
						TypesUtils.MarkDirty();
					}
				}
				else
				{
					foundAll = false;
				}
			}

			if (type.HasFlag(PathType.LocalThreejs))
			{
				// string localPath = default;
				var localPath = packagePath + "/../modules/three";
				if (Directory.Exists(localPath)) settings.localThreejsPackage = PathUtils.MakeProjectRelative(localPath);
				else
				{
					localPath = packagePath + "/package~/node_modules/three";
					if (Directory.Exists(localPath))
					{
						settings.localThreejsPackage = PathUtils.MakeProjectRelative(localPath);
						settings.Save();

						if (runInstall || !File.Exists(settings.localThreejsPackage + "/package.json"))
						{
							await RunNpmInstallAtPath(settings.localRuntimePackage, false);
						}
					}
					else
					{
						// only log if there's actually a path, otherwise the log doesn't make sense
						if (!string.IsNullOrEmpty(runtimePackagePath)) 
							Debug.LogWarning("Path " + localPath + " does not exist, try running npm install in " + runtimePackagePath);
						foundAll = false;
					}
				}
			}

			if (runInstall)
			{
				if (!await InstallCurrentProject(false))
				{
					var exportInfo = Object.FindObjectOfType<ExportInfo>();
					if (exportInfo)
					{
						if (exportInfo.Exists())
							Debug.LogWarning("Failed to install current project, please see the console for errors", exportInfo);
						else 
							Debug.Log("<b>You are ready to create a web project</b>. Select the " + nameof(ExportInfo) + " component to get started!", exportInfo);
					}
					return false;
				}
			}

			return foundAll;
		}

	}
}