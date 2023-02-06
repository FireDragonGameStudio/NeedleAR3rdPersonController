// #nullable enable
//
// using System;
// using System.Collections.Generic;
// using System.Diagnostics;
// using System.IO;
// using System.Reflection;
// using System.Threading.Tasks;
// using Needle.Engine.Attributes;
// using Needle.Engine.Interfaces;
// using Needle.Engine.References;
// using Needle.Engine.Utils;
// using Needle.Engine.Writer;
// using UnityEditor;
// using UnityEngine;
// using UnityEngine.SceneManagement;
// using Debug = UnityEngine.Debug;
//
// namespace Needle.Engine.Core
// {
// 	internal class BuildRunner
// 	{
// 		public string Description;
//
// 		public bool IsBuilding { get; private set; }
// 		public IExportContext? CurrentContext => currentContext;
//
// 		public readonly string BasePath = Application.dataPath + "/../";
// 		private readonly ImportsGenerator importsGenerator = new ImportsGenerator();
// 		private readonly Stopwatch watch = new Stopwatch();
// 		private IEmitter[]? emitters;
// 		private IBuildStageCallbacks[]? buildProcessors;
// 		private readonly List<IBuildCallbackComponent> buildCallbackComponents = new List<IBuildCallbackComponent>();
// 		private int currentBuildProgressId = -1;
// 		private bool isCurrentBuildProgressCancelled = false;
// 		private ExportContext? currentContext = null;
// 		private Task<bool>? currentBuildProcess = default;
//
// 		public async Task<bool> Run(string name, ExportType type, ProjectInfo paths, GameObject[] objects)
// 		{
// 			if (IsBuilding)
// 			{
// 				Debug.LogWarning("Build is already in process");
// 				if (currentBuildProcess != null)
// 					return await currentBuildProcess;
// 				return false;
// 			}
//
// 			var didSucceed = false;
// 			watch.Restart();
//
// 			Debug.Log($"<b>Begin building</b> " + name);
// 			try
// 			{
// 				currentContext = null;
// 				isCurrentBuildProgressCancelled = false;
// 				currentBuildProgressId = Progress.Start(name, Description, Progress.Options.Synchronous);
// 				Progress.RegisterCancelCallback(currentBuildProgressId, () =>
// 				{
// 					Debug.Log("Build was cancelled");
// 					isCurrentBuildProgressCancelled = true;
// 					if (currentContext != null)
// 						currentContext.Cancelled = true;
// 					return true;
// 				});
// 				IsBuilding = true;
// 				using (new CultureScope())
// 				{
// 					currentBuildProcess = InternalRun(type, paths, objects);
// 					didSucceed = await currentBuildProcess;
// 				}
// 			}
// 			catch (Exception e)
// 			{
// 				Debug.LogException(e);
//
// 				// invoke failed callbacks
// 				if (buildProcessors != null)
// 				{
// 					foreach (var proc in buildProcessors)
// 					{
// 						try
// 						{
// 							proc.OnBuild(BuildStage.BuildFailed, currentContext);
// 						}
// 						catch (Exception processorException)
// 						{
// 							Debug.LogException(processorException);
// 						}
// 					}
// 				}
// 			}
// 			finally
// 			{
// 				currentBuildProcess = null;
// 				IsBuilding = false;
// 				Progress.Remove(currentBuildProgressId);
// 			}
//
// 			var elapsed = watch.Elapsed.TotalMilliseconds;
// 			watch.Stop();
// 			var dir = paths.ProjectDirectory;
// 			Debug.Log($"<b>Finished building</b> in {elapsed:0} ms to <a href=\"{dir}\">{dir}</a>");
// 			if (!didSucceed)
// 			{
// 				Debug.LogWarning("<b>Build failed</b> - see logs for reason");
// 			}
// 			return didSucceed;
// 		}
//
// 		private async Task<bool> InternalRun(ExportType type, ProjectInfo projectPaths, GameObject[] objects)
// 		{
// 			buildCallbackComponents.Clear();
// 			if (!Directory.Exists(projectPaths.AssetsDirectory)) Directory.CreateDirectory(projectPaths.AssetsDirectory);
// 			if (!Directory.Exists(projectPaths.ScriptsDirectory)) Directory.CreateDirectory(projectPaths.ScriptsDirectory);
// 			if (!Directory.Exists(projectPaths.GeneratedDirectory)) Directory.CreateDirectory(projectPaths.GeneratedDirectory);
// 			if (!Directory.Exists(projectPaths.EngineComponentsDirectory))
// 			{
// 				Debug.LogWarning("Javascript module components directory not found - <b>try running Needle/Install</b>\n" +
// 				                 projectPaths.EngineComponentsDirectory);
// 				return false;
// 			}
//
// 			if (PlayerSettings.colorSpace != ColorSpace.Linear)
// 			{
// 				Debug.LogWarning("Wrong colorspace: " + PlayerSettings.colorSpace +
// 				                 ", please set to Linear, otherwise your exported project might look incorrect");
// 			}
//
// 			var typesList = new List<ImportInfo>();
// 			importsGenerator.ClearTypes();
// 			importsGenerator.BeginWrite();
//
// 			// TODO: module type exports should go into the module and just be imported here (but need to figure out how to then parse existing scripts from imported modules then)
//
// 			importsGenerator.FindTypes(projectPaths.EngineComponentsDirectory, typesList);
// 			importsGenerator.FindTypes(projectPaths.ExperimentalEngineComponentsDirectory, typesList, false);
// 			importsGenerator.WriteTypes(projectPaths.ModuleDirectory, ProjectInfo.ModuleName + " components");
//
//
// 			// find scripts
// 			importsGenerator.FindTypes(projectPaths.ScriptsDirectory, typesList);
// 			var scriptPath = projectPaths.GeneratedDirectory + "/scripts.js";
// 			importsGenerator.WriteTypes(scriptPath, new DirectoryInfo(projectPaths.ProjectDirectory).Name);
// 			importsGenerator.EndWrite(scriptPath);
//
// 			var generatePath = projectPaths.GeneratedDirectory + "/gen.js";
// 			// using var writer = new StringWriter();//fullPath, false, Encoding.UTF8);
//
// 			var references = new ReferenceRegistry(typesList);
// 			var writer = new CodeWriter(generatePath);
// 			currentContext = new ExportContext(type, projectPaths, writer, references, references);
// 			emitters ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IEmitter>().ToArray();
// 			references.Context = currentContext;
//
// 			// var relativeEnginePath = new Uri(generatePath).MakeRelativeUri(new Uri(projectPaths.EnginePath)).ToString();
// 			// // remove .js
// 			// relativeEnginePath = relativeEnginePath.Substring(0, relativeEnginePath.Length - 3);
// 			writer.Write($"import {{ engine }} from \"{ProjectInfo.ModuleName + "/engine/engine"}\";");
// 			const string registerTypesRelativePath = "./register_types";
// 			if (File.Exists($"{projectPaths.GeneratedDirectory}/{registerTypesRelativePath}.js"))
// 				writer.Write($"import \"{registerTypesRelativePath}\"");
// 			writer.Write("import { scripts } from \"./scripts\";");
// 			writer.Write("import * as THREE from 'three';");
// 			// writer.Write("const { preparing, resolving } = engine.sceneData;");
// 			// writer.Write("const scriptsList = engine.new_scripts;");
// 			// writer.Write("const scene = engine.scene;");
//
// 			buildProcessors ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IBuildStageCallbacks>().ToArray();
// 			// invoke pre build interface implementations
// 			currentContext.Reset();
// 			foreach (var bb in buildProcessors)
// 			{
// 				bb.OnBuild(BuildStage.PreBuildScene, currentContext);
// 			}
//
// 			writer.Write("\n// BUILD SCENE 	(=^･ｪ･^=))ﾉ彡☆");
// 			var fnName = "loadScene";
// 			writer.Write($"const {fnName} = async function(context, opts)");
// 			writer.BeginBlock();
//
// 			writer.Write("const scene = context.scene;");
// 			writer.Write("let scriptsList = context.new_scripts;");
// 			writer.Write("");
//
// 			currentContext.Reset();
// 			foreach (var bb in buildProcessors)
// 			{
// 				bb.OnBuild(BuildStage.BeginSceneLoadFunction, currentContext);
// 			}
//
// 			await Traverse(references, writer, currentContext, emitters, objects);
//
// 			currentContext.Reset();
// 			foreach (var bb in buildProcessors)
// 			{
// 				// this callback is mainly used by the resources gltf
// 				// so any member or field has time to add scene resources
// 				bb.OnBuild(BuildStage.EndSceneLoadFunction, currentContext);
// 			}
//
// 			// we do this so function that get emitted can just use scriptsList but now it points to the global array
// 			writer.Write("// point to global scripts array now");
// 			writer.Write("scriptsList = context.scripts;");
// 			writer.EndBlock();
// 			writer.Write($"engine.build_scene_functions[\"{fnName}\"] = {fnName};");
//
// 			// invoke build interface implementations
// 			currentContext.Reset();
// 			foreach (var bb in buildProcessors)
// 			{
// 				bb.OnBuild(BuildStage.PostBuildScene, currentContext);
// 			}
//
// 			writer.Write("\nconsole.log(\"Made with ♥ by 🌵 needle - https://needle.tools\");");
// 			if (isCurrentBuildProgressCancelled)
// 				writer.Write("console.warn(\"WARNING: The build process of the scene was cancelled - it therefor may be incomplete and throw errors\");");
// 			writer.Flush();
//
// 			foreach (var comp in buildCallbackComponents)
// 			{
// 				comp.OnBuildCompleted();
// 			}
// 			return true;
// 		}
//
// 		private async Task Traverse(ReferenceRegistry references, ICodeWriter writer, ExportContext context, IEmitter[] em, GameObject[] gameObjects)
// 		{
// 			var gos = gameObjects;
// 			for (var index = 0; index < gos.Length; index++)
// 			{
// 				if (isCurrentBuildProgressCancelled) break;
// 				var go = gos[index];
// 				if (!go) continue;
// 				context.Reset();
// 				Progress.Report(currentBuildProgressId, index, gos.Length - 1, $"Traverse {go.name}");
// 				// if we wait every object export becomes shorter. Reporting with sync flag doesnt update the UI immediately
// 				if (index <= 0) await Task.Delay(10);
// 				else if (index % 10 == 0) await Task.Delay(10);
// 				await Traverse(go, context, em);
// 			}
//
// 			if (!isCurrentBuildProgressCancelled)
// 			{
// 				Progress.Report(currentBuildProgressId, 1, 1, $"Resolving references");
// 				await Task.Delay(1);
// 				using (new Timer("Resolving references"))
// 					references.ResolveAndWrite(writer, context);
// 				writer.Write("");
// 			}
// 		}
//
// 		private readonly List<Component> _componentsBuffer = new List<Component>();
//
// 		private async Task Traverse(GameObject go, ExportContext context, IEmitter[] emitter)
// 		{
// 			if (isCurrentBuildProgressCancelled) return;
// 			if (!go) return;
// 			if (!go.CompareTag("EditorOnly"))
// 			{
// 				_componentsBuffer.Clear();
// 				go.GetComponents(_componentsBuffer);
// 				foreach (var comp in _componentsBuffer)
// 				{
// 					if (comp is IBuildCallbackComponent bc)
// 						buildCallbackComponents.Add(bc);
// 				}
//
// 				var wasInGltf = context.IsInGltf;
// 				foreach (var e in emitter)
// 				{
// 					if (isCurrentBuildProgressCancelled) return;
// 					foreach (var comp in _componentsBuffer)
// 					{
// 						if (isCurrentBuildProgressCancelled) return;
// 						ExportComponent(go, comp, context, e);
// 					}
// 				}
// 				var t = go.transform;
// 				var id = t.GetId();
// 				foreach (Transform child in go.transform)
// 				{
// 					if (isCurrentBuildProgressCancelled) return;
// 					var name = $"{t.name}_{id}";
// 					ReferenceExtensions.ToJsVariable(ref name);
// 					context.ParentName = name;
// 					await Traverse(child.gameObject, context, emitter);
// 				}
// 				context.IsInGltf = wasInGltf;
// 			}
// 		}
//
// 		private void ExportComponent(GameObject go, Component comp, ExportContext context, IEmitter emitter)
// 		{
// 			if (isCurrentBuildProgressCancelled) return;
// 			if (!comp)
// 			{
// 				Debug.LogWarning("Missing script on " + go, go);
// 				return;
// 			}
// 			var type = comp.GetType();
// 			if (type.GetCustomAttribute<NeedleTinyIgnore>() != null) return;
// 			context.GameObject = go;
// 			context.Component = comp;
// 			context.VariableName = $"{go.name}_{comp.GetId()}".ToJsVariable();
// 			var res = emitter.Run(comp, context);
// 			if (res.Success)
// 			{
// 				context.IsExported = true;
// 				context.ObjectCreated = res.HierarchyExported;
// 				context.Writer.Write("");
// 			}
// 		}
// 	}
// }