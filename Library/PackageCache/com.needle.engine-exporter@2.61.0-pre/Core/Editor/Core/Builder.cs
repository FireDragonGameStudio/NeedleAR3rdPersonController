#nullable enable

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Needle.Engine.Core.References;
using Needle.Engine.Interfaces;
using Needle.Engine.Problems;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using Needle.Engine.Writer;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;
using UnityEngine.SceneManagement;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;
using Transform = UnityEngine.Transform;

namespace Needle.Engine.Core
{
	public struct BuildInfo
	{
		public readonly string ProjectDirectory;
		public readonly string PackageJsonPath;

		public bool IsValid() => !string.IsNullOrEmpty(ProjectDirectory) && File.Exists(PackageJsonPath);

		public BuildInfo(ExportInfo exp)
		{
			this.ProjectDirectory = exp.DirectoryName;
			this.PackageJsonPath = exp.PackageJsonPath;
		}

		public static BuildInfo FromExportInfo(ExportInfo? i)
		{
			if (i == null) return new BuildInfo();
			return new BuildInfo(i);
		}
	}

	public static class Builder
	{
		public static bool IsBuilding { get; private set; }
		public static IExportContext? CurrentContext => currentContext;

		public static readonly string BasePath = Application.dataPath + "/../";
		private static readonly ImportsGenerator importsGenerator = new ImportsGenerator();
		private static readonly Stopwatch watch = new Stopwatch();
		private static IEmitter[]? emitters;
		private static IBuildStageCallbacks[]? buildProcessors;

		private static readonly List<IBuildCallbackComponent> buildCallbackComponents = new List<IBuildCallbackComponent>();

		// private static int currentBuildProgressId = -1;
		private static bool isCurrentBuildProgressCancelled = false;
		private static ExportContext? currentContext = null;
		private static Task<bool>? currentBuildProcess = default;
		private static bool isWaitingForInstallationToFinish = false;

		public static event Action? BuildStarting, BuildEnded, BuildFailed;

		private const string lockFileName = "needle.lock";

		// https://threejs.org/docs/#manual/en/introduction/Creating-a-scene
		// https://threejs.org/editor/

		internal static async Task<bool> Build(bool isImplicitExport, BuildContext buildContext, int parentTaskId = -1, BuildInfo? info = null)
		{
			if (isImplicitExport && BuildPipeline.isBuildingPlayer)
			{
				Debug.LogWarning("Editor is building – abort export");
				return false;
			}

			if (IsBuilding)
			{
				Debug.LogWarning("Build is already in process");
				if (currentBuildProcess != null)
					return await currentBuildProcess;
				return false;
			}

			if (Actions.IsInstalling())
			{
				Debug.LogWarning("Project is currently installing → waiting for it to finish until trying to export the project");
				if (isWaitingForInstallationToFinish) return false;
				isWaitingForInstallationToFinish = true;
				var didInstall = await Actions.WaitForInstallationToFinish();
				if (!didInstall) return false;
				Debug.Log("Installation finished.");
				if (currentBuildProcess != null)
					return await currentBuildProcess;
			}
			isWaitingForInstallationToFinish = false;

			var didSucceed = false;
			watch.Restart();

			ProjectInfo? paths = default;
			if (info != null)
			{
				paths = new ProjectInfo(Path.GetFullPath(info.Value.ProjectDirectory));
			}
			else if (TryGetProjectInfo(isImplicitExport, out paths, out var expInfo))
			{
				info = BuildInfo.FromExportInfo(expInfo);
			}
			else
				return false;

			BuildTaskList.ResetAllAndCancelRunning();

			Debug.Log($"<b>Begin building</b> web scene");
			using var @lock = new NeedleLock(paths.ProjectDirectory);
			try
			{
				currentContext = null;
				isCurrentBuildProgressCancelled = false;
				IsBuilding = true;
				var nowInMilliSeconds = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
				BuildStarting?.Invoke();
				using (new CultureScope())
				{
					currentBuildProcess = InternalOnBuild(buildContext, paths, info.Value);
					didSucceed = await currentBuildProcess;
				}
			}
			catch (Exception e)
			{
				Debug.LogException(e);

				// invoke failed callbacks
				if (buildProcessors != null)
				{
					foreach (var proc in buildProcessors)
					{
						try
						{
							await proc.OnBuild(BuildStage.BuildFailed, currentContext);
						}
						catch (Exception processorException)
						{
							Debug.LogException(processorException);
						}
					}
				}
			}
			finally
			{
				currentBuildProcess = null;
				IsBuilding = false;
				BuildEnded?.Invoke();
			}

			var elapsed = watch.Elapsed.TotalMilliseconds;
			watch.Stop();
			var dir = paths.ProjectDirectory;
			Debug.Log($"<b>Finished building</b> in {elapsed:0} ms to <a href=\"{dir}\">{dir}</a>");
			if (!didSucceed)
			{
				Debug.LogWarning("<b>Build failed</b> - see logs for reason");
				BuildFailed?.Invoke();
			}

			if (elapsed > 2000 && ExporterProjectSettings.instance.smartExport == false)
			{
				Debug.LogWarning("Consider enabling Smart Export in ProjectSettings/Needle Engine/Settings to speed up build times");
			}
			
			InternalActions.LogFeedbackFormUrl();

			try
			{
				currentContext?.Dispose();
			}
			finally
			{
				currentContext = null;
			}
			
			return didSucceed;
		}

		private static bool TryGetProjectInfo(bool isAutoExport, out ProjectInfo projectPaths, out ExportInfo info)
		{
			projectPaths = null!;
			info = null!;

			var infos = Object.FindObjectsOfType<ExportInfo>();
			if (infos.Length <= 0)
			{
				if (ExporterProjectSettings.instance.debugMode)
					Debug.LogWarning($"Can't auto-build project, no {nameof(ExportInfo)} found in scene.");
				return false;
			}
			if (infos.Length > 1)
				throw new Exception("Found multiple export infos in scene. Only one is allowed: " + string.Join(", ", infos.Select(i => i.name)));

			info = infos[0];

			if (!info.gameObject.activeInHierarchy)
			{
				Debug.LogError(
					$"Your ExportInfo GameObject \"{info.gameObject.name}\" is not enabled. Please make sure the GameObject is active in the hierarchy, otherwise the exported project may not work properly",
					info);
			}

			if (isAutoExport && !info.AutoExport)
				return false;

			if (string.IsNullOrEmpty(info.DirectoryName))
			{
				if (!isAutoExport)
					Debug.LogError("Empty project directory", info);
				return false;
			}


			var projectDir = Path.GetFullPath(info.DirectoryName);
			if (!Directory.Exists(projectDir))
			{
				var msg = "Project directory does not yet exist, select the " + nameof(ExportInfo) + " component and generate a project.\n" + projectDir;
				if (isAutoExport) Debug.LogWarning(msg, info);
				else Debug.LogError(msg);
				info.RequestInstallationIfTempProjectAndNotExists();
				return false;
			}

			projectPaths = new ProjectInfo(projectDir);
			return true;
		}

		private static async Task<bool> InternalOnBuild(BuildContext buildContext, ProjectInfo projectPaths, BuildInfo info)
		{
			if (ProjectValidator.FindProblems(info.PackageJsonPath, out var problems))
			{
				if (!await ProblemSolver.TryFixProblems(projectPaths.ProjectDirectory, problems))
				{
					Debug.LogError("Can not build because package.json has problems. Please fix errors listed below first:",
						Object.FindObjectOfType<ExportInfo>());
					foreach (var p in problems) Debug.LogFormat(LogType.Error, LogOption.NoStacktrace, null, "{0}", p);
					return false;
				}
			}

			var dir = Path.GetFullPath(projectPaths.ProjectDirectory);
			if (DriveHelper.IsFat32Drive(dir))
			{
				Debug.LogWarning(
					"Your project is on FAT32 formatted drive. This will probably cause errors with symlinks created by npm. Consider moving your project to another drive: " +
					dir);
			}

			buildCallbackComponents.Clear();
			if (!Directory.Exists(projectPaths.AssetsDirectory)) Directory.CreateDirectory(projectPaths.AssetsDirectory);
			if (!Directory.Exists(projectPaths.ScriptsDirectory)) Directory.CreateDirectory(projectPaths.ScriptsDirectory);
			if (!Directory.Exists(projectPaths.GeneratedDirectory)) Directory.CreateDirectory(projectPaths.GeneratedDirectory);
			if (!Directory.Exists(projectPaths.EngineComponentsDirectory))
			{
				Debug.LogWarning("Needle Engine directory not found → <b>please run Install</b>\n" +
				                 projectPaths.EngineComponentsDirectory, Object.FindObjectOfType<ExportInfo>());

				if (Actions.IsInstalling() == false && !await Actions.InstallCurrentProject(false))
				{
					return false;
				}
			}

			if (PlayerSettings.colorSpace != ColorSpace.Linear)
			{
				Debug.LogError("<b>Wrong colorspace</b>: " + PlayerSettings.colorSpace +
				               ", please set to Linear, otherwise your exported project will look incorrect. Change under \"Edit/Player/Other Settings\"");
			}

			// var typesList = new List<ImportInfo>();
			importsGenerator.BeginWrite();

			// TODO: module type exports should go into the module and just be imported here (but need to figure out how to then parse existing scripts from imported modules then)

			// find scripts
			var scriptPath = projectPaths.GeneratedDirectory + "/scripts.js";
			// TypesUtils.MarkDirty();
			var types = TypesUtils.GetTypes(projectPaths);
			importsGenerator.WriteTypes(types, scriptPath, new DirectoryInfo(projectPaths.ProjectDirectory).Name);
			importsGenerator.EndWrite(types, scriptPath);

			var generatePath = projectPaths.GeneratedDirectory + "/gen.js";
			// using var writer = new StringWriter();//fullPath, false, Encoding.UTF8);

			var hash = new DateTimeOffset(DateTime.Now).ToUnixTimeMilliseconds().ToString(); //.GetHashCode().ToString();
			var references = new ReferenceRegistry(types);
			var writer = new CodeWriter(generatePath);
			currentContext = new ExportContext(projectPaths.ProjectDirectory, hash, buildContext, projectPaths, writer, references, references, null);
			
			emitters ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IEmitter>().ToArray();
			references.Context = currentContext;
			buildProcessors ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IBuildStageCallbacks>().ToArray();

			foreach (var bb in buildProcessors)
			{
				var res = await bb.OnBuild(BuildStage.Setup, currentContext);
				if (!res)
				{
					Debug.LogError("Setup failed: " + bb.GetType().Name);
					return false;
				}
			}
			
			var runExport = buildContext.Command != BuildCommand.PrepareDeploy;

			if (ExporterProjectSettings.instance.smartExport)
			{
				// Always export the scene for distribution builds
				// This is necessary as long as we fully clear the assets directory
				// We could introduce something like a build distribution cache when smart export is enabled
				if (buildContext.IsDistributionBuild == false)
				{
					var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(SceneManager.GetActiveScene().path);
					if (currentContext.TryGetAssetDependencyInfo(scene, out var sceneAssetInfo))
					{
						if (sceneAssetInfo.HasChanged == false && OutputDirectoryContainsGlbAssets(projectPaths))
						{
							Debug.Log("~ Scene has not changed, skipping build. (Tip: You can force a full export by holding ALT and clicking the 'Play' button on the ExportInfo component)".LowContrast());
							runExport = false;
						}
					}
				}
			}
			
			if (runExport)
			{
				// var relativeEnginePath = new Uri(generatePath).MakeRelativeUri(new Uri(projectPaths.EnginePath)).ToString();
				// // remove .js
				// relativeEnginePath = relativeEnginePath.Substring(0, relativeEnginePath.Length - 3);
				writer.Write($"import {{ engine }} from \"{Constants.RuntimeNpmPackageName + "/engine/engine"}\";");
				const string registerTypesRelativePath = "./register_types";
				writer.Write($"import \"{registerTypesRelativePath}\"");
				writer.Write("import { scripts } from \"./scripts\";");
				writer.Write("import * as THREE from 'three';");
				// writer.Write("const { preparing, resolving } = engine.sceneData;");
				// writer.Write("const scriptsList = engine.new_scripts;");
				// writer.Write("const scene = engine.scene;");

				// invoke pre build interface implementations
				currentContext.Reset();
				foreach (var bb in buildProcessors)
				{
					var res = await bb.OnBuild(BuildStage.PreBuildScene, currentContext);
					if (!res)
					{
						Debug.LogError("PreBuild callback failed: " + bb);
						return false;
					}
				}

				writer.Write("\n// BUILD SCENE 	(=^･ｪ･^=))ﾉ彡☆");
				var fnName = "loadScene";
				writer.Write($"const {fnName} = async function(context, opts)");
				writer.BeginBlock();

				writer.Write("context.hash = \"" + currentContext.Hash + "\";\n");

				writer.Write("const scene = context.scene;");
				writer.Write("let scriptsList = context.new_scripts;");
				writer.Write("");

				currentContext.Reset();
				foreach (var bb in buildProcessors)
				{
					await bb.OnBuild(BuildStage.BeginSceneLoadFunction, currentContext);
				}

				await TraverseGameObjectsInScene(references, writer, currentContext, emitters);

				currentContext.Reset();
				foreach (var bb in buildProcessors)
				{
					// this callback is mainly used by the resources gltf
					// so any member or field has time to add scene resources
					await bb.OnBuild(BuildStage.EndSceneLoadFunction, currentContext);
				}

				// we do this so function that get emitted can just use scriptsList but now it points to the global array
				writer.Write("// point to global scripts array now");
				writer.Write("scriptsList = context.scripts;");
				writer.EndBlock();
				writer.Write($"engine.build_scene_functions[\"{fnName}\"] = {fnName};");

				// invoke build interface implementations
				currentContext.Reset();
				foreach (var bb in buildProcessors)
				{
					await bb.OnBuild(BuildStage.PostBuildScene, currentContext);
				}

				var msg = "Made with ♥ by 🌵 needle - https://needle.tools";
				var version = ProjectInfo.GetCurrentNeedleExporterPackageVersion(out _);
				if (version != null) msg += " — Version " + version;
				writer.Write($"\nconsole.log(\"{Regex.Escape(msg)}\");");
				if (isCurrentBuildProgressCancelled)
					writer.Write("console.warn(\"WARNING: The build process of the scene was cancelled - it therefor may be incomplete and throw errors\");");
				writer.Flush();

				foreach (var comp in buildCallbackComponents)
				{
					comp.OnBuildCompleted();
				}

				// wait for all tasks that must be finished before we can continue
				await BuildTaskList.WaitForPostExportTasksToComplete();
			}


			return true;
		}

		private static bool OutputDirectoryContainsGlbAssets(IProjectInfo proj)
		{
			var dir = proj.AssetsDirectory;
			foreach (var file in Directory.EnumerateFiles(dir, "*.*"))
			{
				if(file.EndsWith(".glb") || file.EndsWith(".gltf"))
				{
					return true;
				}
			}
			return false;
		}

		private static async Task TraverseGameObjectsInScene(ReferenceRegistry references, ICodeWriter writer, ExportContext context, IEmitter[] em)
		{
			var gos = SceneManager.GetActiveScene().GetRootGameObjects();
			for (var index = 0; index < gos.Length; index++)
			{
				if (isCurrentBuildProgressCancelled) break;
				var go = gos[index];
				if (!go) continue;
				context.Reset();
				// if we wait every object export becomes shorter. Reporting with sync flag doesnt update the UI immediately
				if (index <= 0) await Task.Delay(10);
				else if (index % 10 == 0) await Task.Delay(10);
				await Traverse(go, context, em);
			}

			if (!isCurrentBuildProgressCancelled)
			{
				await Task.Delay(1);
				using (new Timer("Resolving references"))
					references.ResolveAndWrite(writer, context);
				writer.Write("");
			}
		}

		private static readonly List<Component> _componentsBuffer = new List<Component>();

		private static async Task Traverse(GameObject go, ExportContext context, IEmitter[] emitter)
		{
			if (isCurrentBuildProgressCancelled) return;
			if (!go) return;
			if (!go.CompareTag("EditorOnly"))
			{
				_componentsBuffer.Clear();
				go.GetComponents(_componentsBuffer);
				foreach (var comp in _componentsBuffer)
				{
					if (comp is IBuildCallbackComponent bc)
						buildCallbackComponents.Add(bc);
				}

				var wasInGltf = context.IsInGltf;
				foreach (var e in emitter)
				{
					if (isCurrentBuildProgressCancelled) return;
					foreach (var comp in _componentsBuffer)
					{
						if (isCurrentBuildProgressCancelled) return;
						ExportComponent(go, comp, context, e);
					}
				}
				var t = go.transform;
				var id = t.GetId();
				foreach (Transform child in go.transform)
				{
					if (isCurrentBuildProgressCancelled) return;
					var name = $"{t.name}_{id}";
					ReferenceExtensions.ToJsVariable(ref name);
					context.ParentName = name;
					await Traverse(child.gameObject, context, emitter);
				}
				context.IsInGltf = wasInGltf;
			}
		}

		private static void ExportComponent(GameObject go, Component comp, ExportContext context, IEmitter emitter)
		{
			if (isCurrentBuildProgressCancelled) return;
			if (!comp)
			{
				Debug.LogWarning("Missing script on " + go, go);
				return;
			}
			var type = comp.GetType();
			if (type.GetCustomAttribute<NeedleEngineIgnore>() != null) return;
			context.Root = go.transform;
			context.GameObject = go;
			context.Component = comp;
			context.VariableName = $"{go.name}_{comp.GetId()}".ToJsVariable();
			var res = emitter.Run(comp, context);
			if (res.Success)
			{
				context.IsExported = true;
				context.ObjectCreated = res.HierarchyExported;
				context.Writer.Write("");
			}
		}
	}
}