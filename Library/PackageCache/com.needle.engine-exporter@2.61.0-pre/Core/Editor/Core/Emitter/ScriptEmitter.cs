/*

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Core.References;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using Unity.Profiling;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Core.Emitter
{
	[Priority(1000)]
	public class ScriptEmitterPerformance : IBuildStageCallbacks
	{
		private static readonly Stopwatch watch = new Stopwatch();
		private static float totalMilliseconds;
		private static int runs;

		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			switch (stage)
			{
				case BuildStage.PreBuildScene:
					ScriptEmitter.componentsExportedInGltfExtras?.Clear();
					totalMilliseconds = 0;
					runs = 0;
					break;
				case BuildStage.PostBuildScene:
					if (runs > 0)
						Debug.Log($"Script emitter ran {runs} times in {totalMilliseconds:0} ms");
					break;
			}
			return Task.FromResult<bool>(true);
		}

		internal static void Start()
		{
			watch.Reset();
			watch.Start();
			runs += 1;
		}

		internal static float Stop()
		{
			watch.Stop();
			var length = (float)watch.Elapsed.TotalMilliseconds;
			totalMilliseconds += length;
			return length;
		}
	}

	[UsedImplicitly]
	public class ScriptEmitter : IEmitter
	{
		internal static readonly HashSet<Component> componentsExportedInGltfExtras = new HashSet<Component>();

		public static void RegisterExportedInGltfExtras(Component comp)
		{
			if (!componentsExportedInGltfExtras.Contains(comp))
				componentsExportedInGltfExtras.Add(comp);
		}

		private ProfilerMarker scriptMarker = new ProfilerMarker("Script Export");
		private ProfilerMarker register = new ProfilerMarker("Register Fields and References");
		private ProfilerMarker additionalData = new ProfilerMarker("Additional Data");
		private ProfilerMarker writeCode = new ProfilerMarker("Write Code");

		public ExportResultInfo Run(Component comp, ExportContext context)
		{
			// TODO: how do we know if a component is/was exported as part of a gltf if the gltf is not exported anymore (due to smart export)
			if (context.IsInGltf && componentsExportedInGltfExtras.Contains(comp))
			{
				return ExportResultInfo.Failed;
			}

			var type = comp.GetType();
			var typeName = type.Name;
			var script = context.TypeRegistry.KnownTypes.FirstOrDefault(t => string.Equals(t.TypeName, typeName, StringComparison.OrdinalIgnoreCase));

			if (script != null)
			{
				ScriptEmitterPerformance.Start();
				var scriptName = $"{context.VariableName}_{type.Name}";
				ReferenceExtensions.ToJsVariable(ref scriptName);

				using (scriptMarker.Auto())
				{
					using (register.Auto())
					{
						var reg = context.References;
						// reg.RegisterField(scriptName, "gameObject", comp.transform);
						// reg.RegisterField(scriptName, "transform", comp.transform);
						reg.RegisterReference(scriptName, comp);
						if (comp is Behaviour b)
							reg.RegisterField(scriptName, comp, "enabled", b.enabled);
						reg.RegisterMembers(scriptName, comp);
					}

					using (writeCode.Auto())
					{
						var writer = context.Writer;
						writer.Write($"// {comp.name} / {script.TypeName}");
						writer.Write($"const {scriptName} = new scripts.{typeName}();");
						if (context.Type == ExportType.Dev)
							writer.Write($"{scriptName}.__name = \"{comp.name}\";");
						writer.Write($"{scriptName}.guid = \"{comp.GetId()}\";");
						if (comp is Camera && !context.IsInGltf)
						{
							writer.Write($"{scriptName}.__notInGltf = true;");
						}
						writer.Write($"scriptsList.push({scriptName});");
						ThreeUtils.WriteVisible(scriptName, context.GameObject, comp, writer);
					}

					var path = scriptName;
					using (additionalData.Auto())
					{
						foreach (var ad in AdditionalEmittersCodegen.Instances)
							ad.EmitAdditionalData(context, comp, path);
					}
				}


				var dur = ScriptEmitterPerformance.Stop();
				if (dur > 50)
				{
					Debug.LogWarning($"Emitting \"{type.Name}\" component on {comp.name} took {dur:0.} ms", comp);
				}
				return new ExportResultInfo(scriptName, false);
			}
			return ExportResultInfo.Failed;
			;
		}
	}
}

*/

