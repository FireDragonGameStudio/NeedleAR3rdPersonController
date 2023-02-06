using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.ShortcutManagement;
using UnityEditorInternal;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	internal static class MenuItems
	{
		private static bool ProjectExists()
		{
			return SceneExportUtils.IsValidExportScene(out _, out _);
		}

		// workaround for broken cubemap if invoked via menu item
		private static Action delayedAction = null;
		private static int framesDelay = -1;

		internal static void RunDelayed(Action act)
		{
			delayedAction = act;
			framesDelay = 60; // play button in 2021.2 needs more frames
			// calling this and then waiting for a frame fixes cubemap export
			InternalEditorUtility.RepaintAllViews();
		}

		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorApplication.update += OnUpdate;
		}

		private static void OnUpdate()
		{
			if (delayedAction == null) return;
			if (framesDelay-- > 0) return;
			// sometimes we still get broken skyboxes when invoked via menu item - maybe this helps
			if (EditorApplication.isUpdating || EditorApplication.isCompiling)
			{
				framesDelay += 1;
				return;
			}
			var isMainThread = InternalEditorUtility.CurrentThreadIsMainThread();
			if (isMainThread) Debug.Log("Invoke callback on main thread");
			else Debug.Log("Invoke callback on another thread");
			var act = delayedAction;
			delayedAction = null;
			act.Invoke();
		}

		[MenuItem(Constants.MenuItemRoot + "/Provide Feedback ♥", false, Constants.MenuItemOrder - 999)]
		private static void ProvideFeedback()
		{
			Application.OpenURL(Constants.FeedbackFormUrl);
		}

		[MenuItem("Help/Needle Engine/Open Documentation", false, Constants.MenuItemOrder)]
		private static void OpenDocs()
		{
			Application.OpenURL(Constants.DocumentationUrl);
		}

		[MenuItem("Help/Needle Engine/Open Samples", false, Constants.MenuItemOrder)]
		private static void OpenSamples()
		{
			Application.OpenURL(Constants.SamplesUrl);
		}
		
		[MenuItem("Help/Needle Engine/Report a Bug", false, Constants.MenuItemOrder)]
		private static void ReportABug()
		{
			Application.OpenURL(Constants.IssuesUrl);
		}

		[MenuItem(Constants.MenuItemRoot + "/Install", true)]
		internal static bool InstallValidate() => ProjectExists();

		[MenuItem(Constants.MenuItemRoot + "/Install", false, Constants.MenuItemOrder + 0)]
		private static async void Install()
		{
			await Actions.RunProjectSetup(Actions.PathType.LocalThreejs | Actions.PathType.NeedleRuntimePackage, true);
		}

		[MenuItem(Constants.MenuItemRoot + "/Start Local Server", true)]
		internal static bool StartDevelopmentServerValidate() => ProjectExists();

		[MenuItem(Constants.MenuItemRoot + "/Start Local Server", false, Constants.MenuItemOrder + 5_000)]
		internal static void StartDevelopmentServer()
		{
			var exportInfo = Object.FindObjectOfType<ExportInfo>();
			StartDevelopmentServer(exportInfo, true);
		}

		[MenuItem(Constants.MenuItemRoot + "/Stop Local Server", true)]
		internal static bool StopDevelopmentServerValidate() => Actions.HasStartedLocalServer();

		[MenuItem(Constants.MenuItemRoot + "/Stop Local Server", false, Constants.MenuItemOrder + 5_000)]
		internal static void StopDevelopmentServer() => Actions.StopLocalServer();


		[MenuItem(Constants.MenuItemRoot + "/Export for Local Server", true)]
		internal static bool BuildNowMenuItemValidate() => ProjectExists();

		[Shortcut("needle-engine-build-dev", KeyCode.B, ShortcutModifiers.Alt)]
		[MenuItem(Constants.MenuItemRoot + "/Export for Local Server\tAlt + B", false, Constants.MenuItemOrder + 5_000)]
		internal static void BuildNowMenuItem()
		{
			RunDelayed(() =>
			{
#pragma warning disable CS4014
				Builder.Build(false, BuildContext.Development);
#pragma warning restore CS4014
			});
		}

		private static DateTime _lastStartTime;
		
		internal static async void StartDevelopmentServer(IProjectInfo proj, bool startUsingIp, int level = 0)
		{
			string path = default;
			if (proj != null) path = proj.ProjectDirectory;
			else SceneExportUtils.IsValidExportScene(out path, out _);

			if (Directory.Exists(path))
			{
				// we need to get the full path here because below 
				// in KillProcessesRunningOtherProject it compares full paths
				path = Path.GetFullPath(path);
				
				var port = 3000;
				if(ViteUtils.TryReadPort(proj?.ProjectDirectory, out var p)) 
					port = p;
				var url = WebHelper.GetLocalServerUrl(startUsingIp, port);
				
				var cmd = "npm start";
#if UNITY_EDITOR_WIN
				cmd += " & timeout 10";
#endif
				Task serverTask = default;
				// check if the server is already running
				if (!await IsResponding())
				{
					if (Actions.IsInstalling())
						await Actions.WaitForInstallationToFinish();
					else await Actions.InstallCurrentProject(false);
					// avoid opening the server twice in a short time
					var now = DateTime.Now;
					if ((now - _lastStartTime).TotalSeconds < .2f) return;
					_lastStartTime = now;
					// await Task.Delay(500);
					// NOTE: if we run without window the process exists (possibly on recompile?!)
					// but with a window we dont get errors in unity e.g. from vite
					var settings = ExporterProjectSettings.instance;
					var showWindow = !settings.debugMode;
					serverTask = ProcessHelper.RunCommand(cmd, path, null, !showWindow);
				}

				// test if server is responding (both https and http)
				async Task<bool> IsResponding()
				{
					// when running on an unknown project (e.g. we export to an existing web project) 
					// then we dont know the exact server url so we ping https and http but this may still fail depending on the config
					// additionally we may get CURL errors in Unity: ``Curl error 60: Cert verify failed: UNITYTLS_X509VERIFY_FLAG_USER_ERROR1``
					if (await WebHelper.IsResponding(url)) return true;
					if(url.StartsWith("https://")) return await WebHelper.IsResponding(url.Replace("https://", "http://"));
					if(url.StartsWith("http://")) return await WebHelper.IsResponding(url.Replace("http://", "https://"));
					return false;
				}

				// open chrome if the server is not already running
				if (serverTask != null)
				{
					Debug.Log($"Open local server at <a href=\"{url}\">{url}</a>");
					Application.OpenURL(url);
				}

				// ping server after some delay
				await Task.Delay(2000);
				if (!await WebHelper.IsResponding(url))
				{
					Debug.LogWarning(
						$"<b>Server is not responding</b>, see commandline/terminal for errors or try running \"<i>{cmd}</i>\" in {path.AsLink()}");
					Actions.TestValidInstallation();
				}
				else
				{
					if (level <= 1)
					{
						if (ProcessUtils.KillProcessesRunningOtherProject(path))
						{
							if (level >= 1)
								Debug.LogError(
									"It seems like stopping other server processes didnt work properly but caused itself (?) to restart. Please report this as a bug and include the following path:\n" +
									path);
							Debug.Log("Hang on - your local dev server will be up and running in just a moment!");
							await Task.Delay(1000);
							StartDevelopmentServer(proj, startUsingIp, ++level);
							return;
						}
					}

					var msg = $"Local server is running at {url.AsLink()}";
					if (!startUsingIp)
					{
						var ipURL = WebHelper.GetLocalServerUrl();
						if (ipURL != url)
							msg += " — for testing on device: " + ipURL.AsLink();
					}
					Debug.Log(msg);
				}

				// wait for server process
				if (serverTask != null && serverTask.Status == TaskStatus.Running)
					await serverTask;
			}
		}


		[MenuItem(Constants.MenuItemRoot + "/Export and Build Dist (Development)", true)]
		internal static bool BuildForDist_Dev_Validate() => ProjectExists();

		[MenuItem(Constants.MenuItemRoot + "/Export and Build Dist (Development)", false, Constants.MenuItemOrder + 10_000)]
		internal static void BuildForDist_Dev()
		{
			BuildForDist_Dev(true);
		}

		private static void BuildForDist_Dev(bool delay)
		{
			if (delay)
				RunDelayed(() => BuildForDist(BuildContext.Development));
			else BuildForDist(BuildContext.Development);
		}

		internal const int MenuItemOrderExport = Constants.MenuItemOrder + 10_000;

		[MenuItem(Constants.MenuItemRoot + "/Export and Build Dist (Production)", true)]
		internal static bool BuildForDist_Production_Validate() => ProjectExists();

		[MenuItem(Constants.MenuItemRoot + "/Export and Build Dist (Production)", false, MenuItemOrderExport)]
		internal static void BuildForDist_Production()
		{
			BuildForDist_Production(true);
		}

		[MenuItem(Constants.MenuItemRoot + "/Build Dist from Last Export (Development)", false, MenuItemOrderExport)]
		private static void ExportDevelopmentDist()
		{
			Actions.BuildDevelopmentDist();
		}

		[MenuItem(Constants.MenuItemRoot + "/Build Dist from Last Export (Production)", false, MenuItemOrderExport)]
		private static async void ExportProductionDist()
		{
			if (await Actions.BuildProductionDist()) Debug.Log($"{"<b>Successfully</b>".AsSuccess()} built production dist");
			else Debug.LogError("Building production dist failed");
		}

		private static void BuildForDist_Production(bool delay)
		{
			if (delay)
				RunDelayed(() => BuildForDist(BuildContext.Production));
			else BuildForDist(BuildContext.Production);
		}

		internal static async void BuildForDist(BuildContext buildContext)
		{
			await BuildForDistAsync(buildContext);
		}


		internal static Task<bool> BuildForDistAsync(BuildContext buildContext)
		{
			if (Actions.IsRunningBuildTask)
			{
				Debug.Log("Build is already running...");
				return Task.FromResult(false);
			}

			Actions.buildTask = InternalExportAndBuildTask(buildContext);
			return Actions.buildTask;
		}

		private static async Task<bool> InternalExportAndBuildTask(BuildContext buildContext)
		{
			if (SceneExportUtils.IsValidExportScene(out var projectDir, out _))
			{
				var isUsingOldToktxVersion = false;
				if (buildContext.ApplyGltfTextureCompression)
				{
					if (!await Actions.HasToktxInstalled())
					{
						if(Application.isBatchMode) Debug.LogWarning("Missing toktx");
						return false;
					}
					if (!Actions.HasMinimumToktxVersionInstalled())
					{
						isUsingOldToktxVersion = true;
						Debug.LogWarning("Old toktx version detected - please update to 4.1+ at " +
						                 "https://github.com/KhronosGroup/KTX-Software/releases".AsLink());
					}
				}
				
				// Before running build check if the project compiles
				if (!await ActionsBuild.BeforeBuild(projectDir))
				{
					await Task.Delay(100);
					Debug.LogError("<b>Pre-build hook failed</b>. See console for errors.");
					await Task.Delay(500);
					if(!EditorUtility.DisplayDialog("Pre Build Script failed", "See console for errors. You can continue the build if you think this was a mistake and your project will run fine.", "Yes: continue building", "No: abort and fix errors"))
						return false;
					// wait a little bit when continuing in case the user decides to abort the process via the Process tab
					await Task.Delay(1000);
				}


				var viteCacheDirectoryPath = projectDir + "/node_modules/.vite";
				if (Directory.Exists(viteCacheDirectoryPath)) Directory.Delete(viteCacheDirectoryPath, true);
				
				var assetsPath = Path.GetFullPath(projectDir + "/assets");
				if (NeedleProjectConfig.TryLoad(projectDir, out var config))
				{
					if(!string.IsNullOrEmpty(config.assetsDirectory))
						assetsPath = Path.GetFullPath(projectDir + "/" + config.assetsDirectory);
				}
				
				// Cache previously exported assets so we only need to re-export if they have changed since we by default delete the previously exported assets
				AssetDependencyCache.CacheDirectory(assetsPath);
				
				// Deleting the previously exported assets to make sure we only have in the final build what we actually need
				if (Directory.Exists(assetsPath))
				{
					try
					{
						Debug.Log("Clear assets at " + assetsPath);
						Directory.Delete(assetsPath, true);
					}
					catch (UnauthorizedAccessException ex)
					{
						Debug.LogWarning("Could not delete assets folder at " + assetsPath + ": " + ex.Message);
					}
				}

				var buildType = buildContext.ToString();
				var buildId = Progress.Start("Build " + buildType + " dist", null, Progress.Options.Indefinite);
				var buildTask = Builder.Build(false, buildContext, buildId);

				var watch = new Stopwatch();
				watch.Start();
				Debug.Log($"<b>Build web dist started ({buildType})</b>");
				var res = await buildTask;
				if (!res)
				{
					Debug.LogError("Build failed and can not continue deployment. See console for errors");
					if (Progress.Exists(buildId))
						Progress.Finish(buildId);
					return false;
				}

				var success = await ActionsBuild.InternalBuildDistTask(buildContext, projectDir, buildId);
				
				AssetDependencyCache.ClearCache();

				if (success)
				{
					watch.Stop();
					var dir = ActionsBuild.GetBuildOutputDirectory(projectDir);
					var stats = FileUtils.CalculateFileStats(new DirectoryInfo(dir));
					Debug.Log($"<b>{buildType} build {"succeeded".AsSuccess()}</b> in {watch.Elapsed.TotalSeconds:0.0} sec: <a href=\"{dir}\">{dir}</a>\n" + stats);
				}
				else
				{
					Debug.Log($"<b>{buildType} build {"failed".AsError()}</b>, check the console for errors");
				}

				if (isUsingOldToktxVersion)
				{
					Debug.LogWarning("Old toktx version detected - please update to 4.1+ at " + "https://github.com/KhronosGroup/KTX-Software/releases".AsLink());
				}

				return success;
			}
			if (Application.isBatchMode)
			{
				Debug.LogError("No valid export scene");
			}
			return false;
		}
	}
}