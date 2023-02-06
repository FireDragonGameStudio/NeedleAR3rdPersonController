using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using JetBrains.Annotations;
using Needle.Engine.Core.Emitter;
using Needle.Engine.Utils;
using UnityEngine;
using UnityGLTF;
using UnityGLTF.JsonPointer;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Gltf.UnityGltf
{
	[UsedImplicitly]
	public class UnityGltfComponentHandler : GltfExtensionHandlerBase
	{
		private readonly List<UnityGltf_NEEDLE_components_Extension> extensions = new List<UnityGltf_NEEDLE_components_Extension>();

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			extensions.Clear();

			if (context.Exporter is GLTFSceneExporter exp) 
				exp.RegisterResolver(this.componentJsonPathResolver);
		}

		public override void OnAfterNodeExport(GltfExportContext context, Transform transform, int nodeId)
		{
			var bridge = context.Bridge;
			var components = transform.gameObject.GetKnownComponents(context.TypeRegistry);

			context.References.RegisterReference(nodeId.AsNodeJsonPointer(), transform);

			if (components?.Count > 0)
			{
				foreach (var comp in components)
				{
					var type = comp.GetType();
					if (context.TypeRegistry.TryGetImportedTypeInfo(type, out var ti) && !ti.IsInstalled)
					{
						Debug.LogWarning("Component " + type.Name + " is not installed in current project, used on " + comp.name + ", script location at " + ti.FilePath.AsLink(), comp);
					}
					// ScriptEmitter.RegisterExportedInGltfExtras(comp);
				}
				var ext = new UnityGltf_NEEDLE_components_Extension(transform, context, context, GltfValueResolver.Default, components);
				bridge.AddNodeExtension(nodeId, UnityGltf_NEEDLE_components_Extension.EXTENSION_NAME, ext);
				extensions.Add(ext);
				for (var i = 0; i < components.Count; i++)
				{
					componentJsonPathResolver.Register(components[i], i);
				}
			}
		}

		private readonly Stopwatch watch = new Stopwatch();
		private readonly StringBuilder timingLog = new StringBuilder();

		private readonly ComponentIndexResolver componentJsonPathResolver = new ComponentIndexResolver();

		public override void OnAfterExport(GltfExportContext context)
		{
			base.OnAfterExport(context);

			var sum = 0f;
			timingLog.Clear();
			var noImpact = 0;
			var noImpactSum = 0L;
			foreach (var ext in extensions)
			{
				watch.Restart();
				ext.OnAfterExport();
				var elapsed = watch.ElapsedMilliseconds;
				sum += elapsed;
				if (elapsed > .1)
				{
					var t = ext.transform;
					var postfix = t ? t.parent?.name + "/" : "";
					timingLog.AppendLine($"{elapsed:0} ms \t{postfix}{ext.name}");
				}
				else
				{
					noImpact += 1;
					noImpactSum += elapsed;
				}
			}
			if (noImpact > 0) timingLog.AppendLine($"and {noImpact} more scripts exported in {noImpactSum:0.0} ms");
			var name = !string.IsNullOrWhiteSpace(context.Path) ? Path.GetFileName(context.Path) : context.Path;
			Debug.Log($"<b>Components</b>: <i>{name}</i> exported {extensions.Count} components: {sum:0} ms\n" + timingLog, context.Root);
			watch.Stop();
			timingLog.Clear();
		}
	}

	internal class ComponentIndexResolver : IJsonPointerResolver
	{
		internal readonly Dictionary<Component, int> indices = new Dictionary<Component, int>();

		public void Register(Component comp, int index)
		{
			if (!indices.ContainsKey(comp))
				indices.Add(comp, index);
			else indices[comp] = index;
		}

		public bool TryResolve(object target, ref string path)
		{
			// when animating gameObject values we dont want them to remap to components
			// e.g. activeSelf should be created by the runtime node/Object3D in threejs if appropriate
			if (target is GameObject)
			{
				return true;
			}
			if (target is Component comp && indices.TryGetValue(comp, out var id))
			{
				var propertyPathIndex = path.LastIndexOf("/", StringComparison.Ordinal);
				var before = path.Substring(0, propertyPathIndex);
				var propertyName = path.Substring(propertyPathIndex);
				var basePath = before + "/extensions/" + UnityGltf_NEEDLE_components_Extension.GetPath(id);
				path = basePath + propertyName;
				return true;
			}
			return false;
		}
	}
}