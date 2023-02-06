#if URP_INSTALLED
using System;
using System.Reflection;
using JetBrains.Annotations;
using Needle.Engine.Gltf;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Needle.Engine.UniversalRenderPipeline
{
	[UsedImplicitly]
	public class URPLightHandler : GltfExtensionHandlerBase, IValueResolver
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			context.RegisterValueResolver(this);
		}

		public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
		{
			if (instance is Light light)
			{
				var isShadowBias = member.Name == nameof(light.shadowBias);
				var isShadowNormalBias = member.Name == nameof(light.shadowNormalBias);

				if (isShadowBias || isShadowNormalBias)
				{
					// Get the URP asset if the light is set to use it
					// If the UniversalLightData component is missing we also use the URP setting
					// since that's what Unity does by default too
					// see UniversalRenderPipelineLightEditor by searching for "m_AdditionalLightDataSO == null"
					UniversalRenderPipelineAsset rp = default;
					var usePipelineSettings = !light.TryGetComponent(out UniversalAdditionalLightData lightData) || lightData.usePipelineSettings;
					if (usePipelineSettings)
					{
						rp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
					}
					
					// For three compatibility we need to map the values
					switch (member.Name)
					{
						case "shadowBias":
							if(rp) value = rp.shadowDepthBias;
							if (value is float shadowBias)
							{
								value = (shadowBias - 1) * .00001f + 0.00001f;
								return true;
							}
							break;
						case "shadowNormalBias":
							if(rp) value = rp.shadowNormalBias;
							if (value is float normalBias)
							{
								value = (normalBias - 1) * -.0025f + 0.015f;
								return true;
							}
							break;
					}
				}
			}
			
			return false;
		}
	}
}
#endif