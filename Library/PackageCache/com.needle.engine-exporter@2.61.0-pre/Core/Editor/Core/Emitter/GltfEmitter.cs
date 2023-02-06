using System;
using System.Collections.Generic;
using System.Diagnostics;
using JetBrains.Annotations;
using Needle.Engine.Core.References;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using Needle.Engine.Writer;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.Emitter
{
	[Priority(1000)]
	[UsedImplicitly]
	public class GltfEmitter : IEmitter
	{
		internal static Action<GltfEmitter, Component, ExportContext> BeforeRun;
		
		public GltfEmitter()
		{
			Builder.BuildStarting += OnBuildStart;
		}

		private static void OnBuildStart()
		{
			didCollectGLTFsInScene = false;
		}

		private static bool didCollectGLTFsInScene = false;
		private static readonly List<IExportableObject> exportableObjectsInScene = new List<IExportableObject>();
		private void EnsureGLTFsInSceneAreCollected()
		{
			if (didCollectGLTFsInScene) return;
			didCollectGLTFsInScene = true;
			exportableObjectsInScene.Clear();
			ObjectUtils.FindObjectsOfType(exportableObjectsInScene);
		}

		public ExportResultInfo Run(Component comp, ExportContext context)
		{
			if (context.IsInGltf) return ExportResultInfo.Failed;
			if (!comp.TryGetComponent(out IExportableObject gltf)) return ExportResultInfo.Failed;
			BeforeRun?.Invoke(this, comp, context);

			context.IsInGltf = true;

			var watch = new Stopwatch();
			watch.Start();

			// TODO: make sure child object names are unique (gltf will bake them unique but we need to know their exported name to emit the correct find variable name)

			var reg = context.References;
			var outputDirectory = context.Project.AssetsDirectory;
			var projectDirectory = context.Project.ProjectDirectory;

			// ReSharper disable once UnusedVariable
			using var util = new RenameUtil(context, comp.gameObject);

			var fileName = gltf.name;
			ReferenceExtensions.ToJsVariable(ref fileName);
			fileName = $"{fileName}{context.GetExtension(comp.gameObject)}";
			var path = $"{outputDirectory}/{fileName}";
			var didExport = gltf.Export(path, false, context);
			var proj = new Uri(projectDirectory + "/", UriKind.Absolute);
			var filePath = new Uri(path, UriKind.Absolute);
			var loadPath = proj.MakeRelativeUri(filePath) + "?v=" + context.Hash;

			var writer = context.Writer;
			string id = default;
			if (gltf is Object obj) id = obj.GetId();
			var variableName = $"{gltf.name}_{id}";
			ReferenceExtensions.ToJsVariable(ref variableName);
			var sceneVariable = $"{variableName}.scene";
			reg.RegisterReference(sceneVariable, comp.transform);

			EnsureGLTFsInSceneAreCollected();
			var index = exportableObjectsInScene.IndexOf(gltf); 
			var options = $"{{name: \"{fileName}\", progress: prog, index: {index}, count: {exportableObjectsInScene.Count}}}";
			var progressEvent = $"prog => opts?.progress?.call(opts, {options})";
			writer.Write($"const {variableName} = await engine.loadSync(context, \"{loadPath}\", null, false, {progressEvent});");
			writer.Write($"if({variableName})");
			writer.BeginBlock(); 
			// dont add guid here because gltf loader/exporter creates intermediate object so this guid would be assigned twice
			// + when using extensions the object's guid is saved and restored as part of the gameObject data extension
			// writer.Write($"{sceneVariable}.guid = \"{comp.transform.GetId()}\";");
			// always add gltfs exported from the scene to the threejs scene root. Previously we did manually emit three objects but this is not supported anymore and in the future we just want to export the whole scene as gltf without having to add GltfObjects 
			// previous: {context.ParentName}
			writer.Write($"scene.add({sceneVariable});");
			writer.EndBlock();

			watch.Stop();
			if (didExport)
				Debug.Log($"<b>Exported</b> {fileName} in {watch.Elapsed.TotalMilliseconds:0} ms", comp);

			return new ExportResultInfo(path, true);
		}
	}
}