#if URP_INSTALLED
using System.Collections.Generic;
using System.Reflection;
using JetBrains.Annotations;
using Needle.Engine.Gltf;
using UnityEngine;
using UnityEngine.Experimental.Rendering.Universal;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Needle.Engine.UniversalRenderPipeline
{
	[UsedImplicitly]
	public class RendererFeaturesExporter : GltfExtensionHandlerBase
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			var srp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
#if URP_12_1_OR_NEWER
			if (srp?.GetRenderer(0) is UniversalRenderer rend)
			#else
			if (srp?.GetRenderer(0) is ForwardRenderer rend)
#endif
			{
				NEEDLE_render_objects ext = default;

				void RegisterExt()
				{
					if (ext != null) return;
					ext = new NEEDLE_render_objects(context.Serializer);
					context.Bridge.AddExtension(NEEDLE_render_objects.EXTENSION_NAME, ext);
				}

				// TODO: where do we get the base override stencil "Value" property from?
				// var stencilStateProperty = typeof(ForwardRenderer).GetField("m_DefaultStencilState", BindingFlags.Instance | BindingFlags.NonPublic);
				// if (stencilStateProperty?.GetValue(rend) is StencilState overrideStencil && overrideStencil.enabled)
				// {
				// 	RegisterExt();
				// 	var model = new StencilSettingsModel("override", overrideStencil);
				// 	ext.AddStencilModel(model);
				// }

				var featuresProperty = typeof(ScriptableRenderer).GetProperty("rendererFeatures", BindingFlags.Instance | BindingFlags.NonPublic);
				if (featuresProperty?.GetValue(rend) is List<ScriptableRendererFeature> features)
				{
					for (var index = 0; index < features.Count; index++)
					{
						var feature = features[index];
						switch (feature)
						{
							case RenderObjects renderObjects:
								RegisterExt();
								if (StencilSettingsModel.TryCreate(renderObjects, index, out var model))
									ext.AddStencilModel(model);
								break;
						}
					}
				}
			}
		}
	}
}
#endif