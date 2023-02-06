using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.AdditionalData;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace Needle.Engine.Gltf
{
	[UsedImplicitly]
	internal class AdditionalParticleSystemData : BaseAdditionalData
	{
		public override void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData)
		{
			if (instance is ParticleSystemRenderer renderer)
			{
				if (context is GltfExportContext gltfExportContext)
				{
					if (renderer.sharedMaterial)
					{
						gltfExportContext.Bridge.AddMaterial(renderer.sharedMaterial);
						var id = gltfExportContext.Bridge.TryGetMaterialId(renderer.sharedMaterial);
						additionalData.Add(("particleMaterial", id.AsMaterialPointer()));
					}

					if (renderer.trailMaterial)
					{
						gltfExportContext.Bridge.AddMaterial(renderer.trailMaterial);
						var id = gltfExportContext.Bridge.TryGetMaterialId(renderer.trailMaterial);
						additionalData.Add(("trailMaterial", id.AsMaterialPointer()));
					}

					additionalData.Add(("renderMode", renderer.renderMode));

					switch (renderer.renderMode)
					{
						case ParticleSystemRenderMode.Mesh:
							var mesh = renderer.mesh;
							if (mesh)
							{
								var id = gltfExportContext.Bridge.AddMesh(mesh);
								additionalData.Add(("particleMesh", id.AsMeshPointer()));
							}
							break;
					}
				}
			}
			else if (instance is ParticleSystem particleSystem)
			{
				if (particleSystem.emission.burstCount > 0)
				{
					var bursts = new ParticleSystem.Burst[particleSystem.emission.burstCount];
					particleSystem.emission.GetBursts(bursts);
					additionalData.Add(("bursts", bursts));
				}

				if (particleSystem.subEmitters.subEmittersCount > 0)
				{
					var arr = new JArray();
					for (var i = 0; i < particleSystem.subEmitters.subEmittersCount; i++)
					{
						var subEmitter = particleSystem.subEmitters.GetSubEmitterSystem(i);
						var obj = new JObject();
						var reference = new JObject();
						reference["guid"] = subEmitter.GetId();
						obj["particleSystem"] = reference;

						var props = particleSystem.subEmitters.GetSubEmitterProperties(i);
						obj["properties"] = (int)props;

						var emitProbability = particleSystem.subEmitters.GetSubEmitterEmitProbability(i);
						obj["emitProbability"] = emitProbability;

						var type = particleSystem.subEmitters.GetSubEmitterType(i);
						obj["type"] = (int)type;

						arr.Add(obj);
					}
					additionalData.Add(("subEmitterSystems", arr));
				}
			}
		}
	}

	internal static class ParticleSystemUtils
	{
		public static Color ToLinear(Color color)
		{
			// color.r = Mathf.Pow(color.r, 2.2f);
			// color.g = Mathf.Pow(color.g, 2.2f);
			// color.b = Mathf.Pow(color.b, 2.2f);
			return color;
		}
	}
}