using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using Unity.SharpZipLib.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;

namespace Needle.Engine.Problems
{
	internal static class ProjectInfoReporter
	{
		private class CollectionSettings
		{
			public bool IncludeNodeModulesFolderVersions = false;
			public bool IncludeUnityProjectAssets = false;
			public bool IncludeWebProjectAssets = false;
		}

		private const string LogCollectionEntry = "Zip Logs only";
		private const string ProjectBundleEntry = "Zip Scene (includes Logs)";
		private const string CopyProjectInfoEntry = "Copy Project Info";
		internal const int HelpItemPriority = Constants.MenuItemOrder + 1000;

		[MenuItem(Constants.MenuItemRoot + "/Bug Report/Show Directory", priority = Constants.MenuItemOrder)]
		private static void OpenBugReportDirectory()
		{
			var dir = GetBugReportDirectory();
			if (Directory.Exists(dir))
				EditorUtility.RevealInFinder(dir);
			else Debug.Log("Bug Report Directory does not exist: " + dir);
		}

		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/" + LogCollectionEntry)]
		[MenuItem(Constants.MenuItemRoot + "/Bug Report/" + LogCollectionEntry, priority = Constants.MenuItemOrder)]
		[MenuItem("Help/Needle Engine/" + LogCollectionEntry, priority = HelpItemPriority)]
		private static void CollectLogs()
		{
			InternalCollectDebugFiles("Needle Bug Report", new CollectionSettings()
			{
				IncludeNodeModulesFolderVersions = true,
				IncludeUnityProjectAssets = false,
				IncludeWebProjectAssets = false
			});
		}


		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/" + ProjectBundleEntry)]
		[MenuItem(Constants.MenuItemRoot + "/Bug Report/" + ProjectBundleEntry, priority = Constants.MenuItemOrder)]
		[MenuItem("Help/Needle Engine/" + ProjectBundleEntry, priority = HelpItemPriority)]
		private static void ZipProject()
		{
			InternalCollectDebugFiles("Needle Bug Report", new CollectionSettings()
			{
				IncludeNodeModulesFolderVersions = true,
				IncludeUnityProjectAssets = true,
				IncludeWebProjectAssets = true
			});
		}


		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/" + CopyProjectInfoEntry)]
		[MenuItem(Constants.MenuItemRoot + "/Bug Report/" + CopyProjectInfoEntry, priority = Constants.MenuItemOrder)]
		[MenuItem("Help/Needle Engine/" + CopyProjectInfoEntry, priority = HelpItemPriority)]
		private static async void CopyProjectInfo()
		{
			var exportInfo = Object.FindObjectOfType<ExportInfo>(true);
			if (!exportInfo)
			{
				EditorGUIUtility.systemCopyBuffer = "No ExportInfo found in the scene";
				Debug.LogError("No ExportInfo component in scene");
				return;
			}
			Debug.Log("Copying project info - please wait a second");
			var info = await ProjectInfoModel.Create(exportInfo);
			info.TypeScriptTypes.Clear();
			var json = info.ToString();
			EditorGUIUtility.systemCopyBuffer = json;
			Debug.Log("<b>Copied</b> project info to clipboard");
		}

		private static string GetBugReportDirectory()
		{
#if UNITY_EDITOR_WIN
			var baseDir = Path.Combine(Path.GetTempPath(), "Needle/BugReports");
#else
			var baseDir = Application.dataPath + "/../Temp/Needle/Reports";
#endif
			return baseDir;
		}

		private static async void InternalCollectDebugFiles(string header, CollectionSettings settings)
		{
			var reportDirectory = GetBugReportDirectory() + "/" + DateTime.Now.ToString("yyMMdd-hhmmss") + "/Report";
			try
			{
				var exportInfo = Object.FindObjectOfType<ExportInfo>(true);
				if (!exportInfo)
				{
					Debug.LogError(
						$"Your current scene is not setup for exporting with Needle Engine! Please see {Constants.DocumentationUrl.AsLink()} for more information. Abort collecting logs.");
					return;
				}

				if (EditorUtility.DisplayCancelableProgressBar(header, "Collecting project information...", 0.1f))
					return;

				Directory.CreateDirectory(reportDirectory);
				var projectPath = exportInfo.GetProjectDirectory();
				var projectDir = new DirectoryInfo(projectPath);
				var infoPath = reportDirectory + "/project-info.json";
				var proj = await ProjectInfoModel.Create(exportInfo);
				proj.SaveTo(infoPath);

				if (EditorUtility.DisplayCancelableProgressBar(header, "Collect known typescript types...", .2f))
					return;

				var projectInfoDirectoryPath = reportDirectory + "/project/" + projectDir.Name;
				Directory.CreateDirectory(projectInfoDirectoryPath);
				var webDirectory = new DirectoryInfo(projectInfoDirectoryPath);
				if (EditorUtility.DisplayCancelableProgressBar(header, "Collecting web project: " + webDirectory.Name, 0.4f))
					return;
				CopyWebProjectFiles(projectDir, webDirectory, settings);


				var unityProjectName = new DirectoryInfo(Application.dataPath + "/..").Name;
				var projectName = settings.IncludeUnityProjectAssets ? (unityProjectName + "_BugReport") : "unity";
				if (EditorUtility.DisplayCancelableProgressBar(header, "Collecting unity project: " + unityProjectName, 0.8f))
					return;
				CopyUnityProjectFiles(new DirectoryInfo(reportDirectory + "/" + projectName), settings, exportInfo.DirectoryName, webDirectory);


				if (EditorUtility.DisplayCancelableProgressBar(header, "Zip files", 1f))
					return;
				var outputName = "Bugreport-" + SceneManager.GetActiveScene().name;
				outputName += "-" + DateTime.Now.ToString("yyMMdd-hhmmss");
				var additionalFlags = "";
				if (settings.IncludeUnityProjectAssets) additionalFlags += "u";
				if (settings.IncludeWebProjectAssets) additionalFlags += "w";
				if (!string.IsNullOrEmpty(additionalFlags)) outputName += "_" + additionalFlags;

				var zipPath = Path.GetFullPath(reportDirectory + "/../" + outputName + ".zip");
				ZipUtility.CompressFolderToZip(zipPath, null, reportDirectory);
				Debug.Log("<b>Created report file</b> at " + zipPath.AsLink() +
				          ", please send to the Needle team for debugging purposes (this file may contain sensitive information, so please only send to the development team directly and don't upload it to a public place).");
				EditorUtility.RevealInFinder(zipPath);
				EditorUtility.DisplayCancelableProgressBar(header, "Rename output directory", 1f);
				var newDir = zipPath.Substring(0, zipPath.LastIndexOf(".", StringComparison.Ordinal));
				Directory.Move(reportDirectory, newDir);
			}
			catch (Exception ex)
			{
				var error = ex.ToString();
				File.WriteAllText(reportDirectory + "/exception_on_collecting_error_logs.oops", error);
			}
			finally
			{
				EditorUtility.ClearProgressBar();
			}
		}

		private static void CopyUnityProjectFiles(DirectoryInfo to,
			CollectionSettings settings,
			string exportInfoProjectPath,
			DirectoryInfo reportedWebDirectory)
		{
			try
			{
				bool TraverseDirectory(DirectoryInfo d) => d.Name != "node_modules" && d.Name != ".git";

				Directory.CreateDirectory(to.FullName);
				var projectDir = new DirectoryInfo(Application.dataPath + "/..");

				var componentGenLog = projectDir + "/Temp/component-compiler.log";
				if (File.Exists(componentGenLog))
				{
					File.Copy(componentGenLog, to.FullName + "/component-compiler.log");
				}

				// Copy toplevel directory files (max 500kb)
				FileUtils.CopyRecursively(projectDir, to, f =>
				{
					switch (f.Extension)
					{
						case ".csproj":
						case ".sln":
						case ".DotSettings":
						case ".user":
						case ".exe":
							return false;
					}
					return f.Length < 1024 * 512;
				}, d => false);

				var sourceScenePath = SceneManager.GetActiveScene().path;
				var dependencyPaths = AssetDatabase.GetDependencies(sourceScenePath, true).ToList();
				var dependencyPathsJson = JsonConvert.SerializeObject(dependencyPaths, Formatting.Indented);
				File.WriteAllText(to.FullName + "/scene_dependencies.json", dependencyPathsJson);
				// ensure we grab all meta files as well
				for (var index = dependencyPaths.Count - 1; index >= 0; index--)
				{
					var dep = dependencyPaths[index];
					dependencyPaths.Add(dep + ".meta");
					
					// Workaround until gltf importer properly registers .bin dependencies
					// assume a .bin file with the same name as the .gltf file next to it is a dependency
					if (dep.EndsWith(".gltf"))
					{
						var binPath = dep.Substring(0, dep.Length - 5) + ".bin";
						if (File.Exists(binPath))
						{
							dependencyPaths.Add(binPath);
							dependencyPaths.Add(binPath + ".meta");
						}
					}
				}
				var sceneDependencies = dependencyPaths.Select(p => new FileInfo(p)).ToArray();

				foreach (var dir in projectDir.EnumerateDirectories())
				{
					switch (dir.Name)
					{
						case "Assets":
							if (settings.IncludeUnityProjectAssets)
							{
								FileUtils.CopyRecursively(dir, new DirectoryInfo(to + "/" + dir.Name),
									f => sceneDependencies.Any(d => d.FullName == f.FullName),
									TraverseDirectory);
							}
							break;
						case "Library":
							if (settings.IncludeUnityProjectAssets)
							{
								var filePath = dir.FullName + "/LastSceneManagerSetup.txt";
								if (File.Exists(filePath))
								{
									var targetLibrary = to.FullName + "/Library";
									Directory.CreateDirectory(targetLibrary);
									File.Copy(filePath, targetLibrary + "/LastSceneManagerSetup.txt");
								}
							}
							break;
						case "Logs":
						case "Packages":
						case "ProjectSettings":
							FileUtils.CopyRecursively(dir, new DirectoryInfo(to + "/" + dir.Name),
								f => f.Length < 1024 * 1024,
								d => false);
							break;
						case "UserSettings":
							FileUtils.CopyRecursively(dir, new DirectoryInfo(to + "/" + dir.Name),
								f => f.Length < 1024 * 1024 && f.Name.Contains("Needle"),
								d => false);
							break;
					}
				}

				if (settings.IncludeUnityProjectAssets)
				{
					var rp = GraphicsSettings.currentRenderPipeline;
					if (rp)
					{
						CopyAsset(rp);

						if (rp.GetType()
							    .GetField("m_RendererDataList", BindingFlags.Instance | BindingFlags.NonPublic)
							    ?.GetValue(rp) is Array array)
						{
							foreach (var entry in array)
							{
								if (entry is Object obj)
									CopyAsset(obj);
							}
						}

						void CopyAsset(Object asset)
						{
							var assetPath = AssetDatabase.GetAssetPath(asset);
							var sourcePath = Path.GetFullPath(assetPath);
							var targetPath = to.FullName + "/" + assetPath;
							var dir = Path.GetDirectoryName(targetPath);
							if (dir != null)
							{
								Directory.CreateDirectory(dir);
								File.Copy(sourcePath, targetPath, true);
								var sourceMeta = sourcePath + ".meta";
								var targetMeta = targetPath + ".meta";
								if (File.Exists(sourceMeta))
									File.Copy(sourceMeta, targetMeta, true);
							}
						}
					}
				}

				// if both the unity project and the web project are included 
				// attempt to re-write the project directory in the reported scene
				// so it will already point to the correct report project
				if (settings.IncludeUnityProjectAssets && settings.IncludeWebProjectAssets)
				{
					if (exportInfoProjectPath != null)
					{
						var resultScenePath = to.FullName + "/" + sourceScenePath;
						if (File.Exists(resultScenePath))
						{
							var content = File.ReadAllLines(resultScenePath);
							var lineToReplace = "  DirectoryName: " + exportInfoProjectPath;
							var newPath = "  DirectoryName: " + reportedWebDirectory.FullName.RelativeTo(to.FullName + "/");
							var found = false;
							for (var index = 0; index < content.Length; index++)
							{
								var line = content[index];
								if (line == lineToReplace)
								{
									found = true;
									content[index] = newPath;
									break;
								}
							}
							if (found) File.WriteAllLines(resultScenePath, content);
						}
					}
				}

				if (settings.IncludeUnityProjectAssets)
				{
					var sourcePackagesDir = projectDir.FullName + "/Packages";
					var targetPackagesDir = to.FullName + "/Packages";
					var manifestPath = to.FullName + "/Packages/manifest.json";
					CollectLocalPackages(manifestPath);

					void CollectLocalPackages(string packageManifestPath)
					{
						if (File.Exists(packageManifestPath) && PackageUtils.TryReadDependencies(packageManifestPath, out var deps, "dependencies"))
						{
							var newDependencies = new Dictionary<string, string>();
							foreach (var dep in deps)
							{
								var value = dep.Value;
								var isEmbedded = false;
								if (PackageUtils.TryGetPath(sourcePackagesDir, dep.Value, out var path))
								{
									if (Directory.Exists(path))
									{
										// ignore packages that are not used by any scene dependency
										var packageDir = new DirectoryInfo(path);
										// we can not filter packages currently because we would have to check dependencies between packages then too (e.g. needle engine requires unity gltf etc)
										// var packagePath = packageDir.FullName;
										// if (!sceneDependencies.Any(d => d.FullName.StartsWith(packagePath)))
										// 	continue;

										var embeddedPath = targetPackagesDir + "/" + dep.Key;
										isEmbedded = true;
										Directory.CreateDirectory(embeddedPath);
										FileUtils.CopyRecursively(
											packageDir,
											new DirectoryInfo(embeddedPath), f => f.Length < 1024 * 1024 * 4, TraverseDirectory);
									}
								}
								if (!isEmbedded)
									newDependencies.Add(dep.Key, value);
							}
							File.Copy(packageManifestPath, packageManifestPath + ".original.json", true);
							PackageUtils.TryWriteDependencies(packageManifestPath, newDependencies, "dependencies");
						}
					}
				}

				var needleLibrary = new DirectoryInfo(projectDir + "/Library/Needle");
				if (needleLibrary.Exists)
				{
					FileUtils.CopyRecursively(needleLibrary, new DirectoryInfo(to + "/Library/Needle"),
						f => f.Length < 1024 * 512,
						d => false);
				}

				string log1 = default, log2 = default;
#if UNITY_EDITOR_WIN
				var localDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "/Unity/Editor";
				log1 = localDir + "/Editor.log";
				log2 = localDir + "/Editor-prev.log";
#elif UNITY_EDITOR_OSX
				log1 = "~/Library/Logs/Unity/Editor.log";
				log2 = "~/Library/Logs/Unity/Editor-prev.log";
#else
				log1 = "~/.config/unity3d/Editor.log";
				log2 = "~/.config/unity3d/Editor-prev.log";
#endif

				var log1File = new FileInfo(log1);
				if (log1File.Exists && log1File.Length < 1024 * 1024 * 10)
				{
					var target = to.FullName + "/Editor.log";
					File.Copy(log1File.FullName, target);
					// AnonymizeSerialInEditorLog(target);
				}
				var log2File = new FileInfo(log2);
				if (log2File.Exists && log2File.Length < 1024 * 1024 * 10)
				{
					var target = to.FullName + "/Editor-prev.log";
					File.Copy(log2File.FullName, target, true);
					// AnonymizeSerialInEditorLog(target);
				}
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}
		}

		// private static void AnonymizeSerialInEditorLog(string editorLogPath)
		// {
		// 	if (!File.Exists(editorLogPath)) return;
		// 	var content = File.ReadAllText(editorLogPath);
		//	// serial regex: \"[\d\w]{2}\-[\d\w]{4}\-[\d\w]{4}\-[\d\w]{4}\-[\d\w]{4}\-[\d\w]{4}\"
		// }

		private static void CopyWebProjectFiles(DirectoryInfo webProjectDir, DirectoryInfo to, CollectionSettings settings)
		{
			Directory.CreateDirectory(to.FullName);
			FileUtils.CopyRecursively(webProjectDir, to, f => f.Length < 1024 * 1024 * 2,
				d => settings.IncludeWebProjectAssets && d.Name != "node_modules");

			var info = new ProjectInfo(webProjectDir.FullName);

			var logsList = new List<string>();
			const float logsMaxAgeInSeconds = 24 * 60 * 60; // get npm logs of last 24 hours
			var npmLogsDir = to.FullName + "/npm_logs";
			Directory.CreateDirectory(npmLogsDir);
			if (NpmLogCapture.GetLastLogFileCreated(out var newest, logsMaxAgeInSeconds, logsList))
			{
				foreach (var log in logsList)
					File.Copy(log, npmLogsDir + "/" + Path.GetFileName(log), true);
			}

			if (settings.IncludeNodeModulesFolderVersions)
			{
				var nodeModules = new DirectoryInfo(webProjectDir.FullName + "/node_modules");
				var targetDir = to.FullName + "/node_modules_versions";
				Directory.CreateDirectory(targetDir);
				CopyDirectoriesAsFiles(nodeModules);

				void CopyDirectoriesAsFiles(DirectoryInfo directory, string prefix = null)
				{
					if (!directory.Exists) return;
					foreach (var dir in directory.EnumerateDirectories())
					{
						if (dir.Name.StartsWith("@"))
						{
							CopyDirectoriesAsFiles(dir, dir.Name + "-");
							continue;
						}
						var path = targetDir + "/" + prefix + dir.Name;
						var finalPath = path;
						if (PackageUtils.TryGetVersion(dir.FullName + "/package.json", out var ver))
							finalPath += "@" + ver;
						try
						{
							File.WriteAllText(finalPath, ver);
						}
						catch (Exception)
						{
							try
							{
								File.WriteAllText(path + "@missing-version", ver);
							}
							catch (Exception e)
							{
								Debug.LogException(e);
							}
						}
					}
				}
			}


			if (!settings.IncludeWebProjectAssets)
			{
				var scriptsPath = new DirectoryInfo(info.ScriptsDirectory);
				if (scriptsPath.Exists)
				{
					// TODO: find relative path to projectFolder
					var targetPath = new DirectoryInfo(to.FullName + "/src/scripts");
					FileUtils.CopyRecursively(scriptsPath, targetPath, f => f.Length < 1024 * 128, d => true);
				}

				var genPath = new DirectoryInfo(info.GeneratedDirectory);
				if (genPath.Exists)
				{
					// TODO: find relative path to projectFolder
					var targetPath = new DirectoryInfo(to.FullName + "/src/generated");
					FileUtils.CopyRecursively(genPath, targetPath, f => f.Length < 1024 * 128, d => true);
				}
			}
			else
			{
				var packageJson = info.PackageJsonPath;
				CopyLocalPackagesAndRewriteDeps(
					new FileInfo(packageJson),
					new FileInfo(to.FullName + "/package.json")
				);

				void CopyLocalPackagesAndRewriteDeps(FileInfo packageJsonPath, FileInfo copiedPackageJsonPath)
				{
					if (packageJsonPath.Exists && PackageUtils.TryReadDependencies(packageJsonPath.FullName, out var deps))
					{
						var targetDirectory = copiedPackageJsonPath.Directory!.FullName;
						foreach (var dep in deps)
						{
							if (dep.Key == "three") continue;
							if (dep.Key == Constants.RuntimeNpmPackageName) continue;
							if (PackageUtils.TryGetPath(packageJsonPath.Directory!.FullName, dep.Value, out var path))
							{
								var relativeDirectory = "local_dependencies/" + dep.Key;
								var copyTo = new DirectoryInfo(targetDirectory + "/" + relativeDirectory);
								copyTo.Create();
								FileUtils.CopyRecursively(new DirectoryInfo(path), copyTo, f => f.Length < 1024 * 1024 * 2, d => d.Name != "node_modules");
								PackageUtils.ReplaceDependency(copiedPackageJsonPath.FullName, dep.Key, relativeDirectory);
							}
						}
					}
				}
			}
		}

		private class ProjectInfoModel
		{
			public string ExportInfoGameObjectName;
			public bool ExportInfoGameObjectIsEnabled;
			public string UnityProjectPath;
			public string UnityVersion;
			public string SceneName;
			public string ProjectPath;
			public bool ProjectDirectoryExists;
			public bool ProjectIsInstalled;
			public bool NeedleEngineInstalled;
			public bool HasNodeInstalled;
			public string NodeVersion;
			public string NpmVersion;
			public bool HasTokTxInstalled;
			public bool HasMinimumToktxVersionInstalled;
			public string RenderPipeline;
			public bool GzipEnabled;
			public string NeedleEngineExporterVersion;
			public string NeedleEngineVersion;
			public string NeedleEngineExporterPath;
			public string NeedleEnginePath;
			public string FileStats;
			public List<string> NeedleComponentsInScene = new List<string>();
			public bool TypeCacheIsDirty;
			public List<ImportInfo> TypeScriptTypes;

			public static async Task<ProjectInfoModel> Create(ExportInfo info)
			{
				var exporterVersion = ProjectInfo.GetCurrentNeedleExporterPackageVersion(out var exporterPackageJsonPath);
				var runtimeVersion = ProjectInfo.GetCurrentNeedleEnginePackageVersion(out var runtimePackageJsonPath);
				var nodejsInstalled = await Actions.HasNpmInstalled();
				var hasTokTxInstalled = await Actions.HasToktxInstalled();
				var model = new ProjectInfoModel()
				{
					ExportInfoGameObjectName = info.name,
					ExportInfoGameObjectIsEnabled = info.gameObject.activeInHierarchy,
					UnityProjectPath = Application.dataPath,
					UnityVersion = Application.unityVersion,
					ProjectPath = info.DirectoryName,
					SceneName = SceneManager.GetActiveScene().name,
					ProjectDirectoryExists = info.Exists(),
					ProjectIsInstalled = info.IsInstalled(),
					NeedleEngineInstalled = Directory.Exists(ProjectInfo.GetNeedleEngineRuntimePackageDirectory(info.GetProjectDirectory())),
					HasNodeInstalled = nodejsInstalled,
					HasTokTxInstalled = hasTokTxInstalled,
					HasMinimumToktxVersionInstalled = Actions.HasMinimumToktxVersionInstalled(),
					RenderPipeline = GraphicsSettings.currentRenderPipeline ? GraphicsSettings.currentRenderPipeline.ToString() : "Built-in",
					GzipEnabled = NeedleEngineBuildOptions.UseGzipCompression,
					NeedleEngineVersion = runtimeVersion,
					NeedleEngineExporterVersion = exporterVersion,
					NeedleEnginePath = runtimePackageJsonPath,
					NeedleEngineExporterPath = exporterPackageJsonPath,
					FileStats = FileUtils.CalculateFileStats(new DirectoryInfo(info.GetProjectDirectory() + "/assets")),
					TypeCacheIsDirty = TypesUtils.IsDirty,
				};
				if (nodejsInstalled)
				{
					try
					{
						var nodeLogs = string.Join("; ", ProcessHelper.RunCommandEnumerable("node --version").ToArray());
						model.NodeVersion = nodeLogs;
						var npmLogs = string.Join("; ", ProcessHelper.RunCommandEnumerable("npm --version").ToArray());
						model.NpmVersion = npmLogs;
					}
					catch (Exception)
					{
						// ignored
					}
				}
				model.CollectNeedleComponentsInProject();
				model.TypeScriptTypes = TypesUtils.CurrentTypes.ToList();
				return model;
			}

			private void CollectNeedleComponentsInProject()
			{
				var list = new List<Component>();
				foreach (var root in SceneManager.GetActiveScene().GetRootGameObjects())
				{
					root.GetComponentsInChildren(list);
					foreach (var comp in list)
					{
						try
						{
							if (!comp) continue;
							var type = comp.GetType();
							if (type.Namespace?.Contains("Needle") ?? false)
							{
								if (!NeedleComponentsInScene.Contains(type.FullName))
									NeedleComponentsInScene.Add(type.FullName);
								// NeedleComponents.Add(EditorJsonUtility.ToJson(comp));
							}
						}
						catch (Exception ex)
						{
							Debug.LogException(ex);
						}
					}
				}
			}

			public void SaveTo(string path)
			{
				if (File.Exists(path)) File.Delete(path);
				File.WriteAllText(path, ToString());
			}

			public override string ToString()
			{
				var json = JsonConvert.SerializeObject(this, Formatting.Indented);
				return json;
			}
		}
	}
}