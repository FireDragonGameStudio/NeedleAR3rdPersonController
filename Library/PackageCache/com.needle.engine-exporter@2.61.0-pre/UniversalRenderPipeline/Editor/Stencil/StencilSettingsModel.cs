#if URP_INSTALLED
using UnityEngine;
using UnityEngine.Experimental.Rendering.Universal;
using UnityEngine.Rendering;

namespace Needle.Engine.UniversalRenderPipeline
{
	public class StencilSettingsModel
	{
		public string name;
		
		// e.g. AfterRenderingOpaques
		public int @event;

		// the index of the RenderObjects entry 
		public int index;

		// Opaque
		public int queue;
		public int layer;

		public int value;
		public CompareFunction compareFunc;
		public StencilOp passOp;
		public StencilOp failOp;
		public StencilOp zFailOp;

		public static bool TryCreate(RenderObjects feature, int index, out StencilSettingsModel model)
		{
			model = null;
			if (!feature.isActive && feature.settings.stencilSettings.overrideStencilState) return false;
			model = new StencilSettingsModel(feature, index);
			return true;
		}

		public StencilSettingsModel(string name, StencilState state)
		{
			this.name = name;
			@event = 255;
			index = 0;
			queue = 255;
			// enable for all layers
			layer = 255;
			value = (int)state.writeMask;
			compareFunc = state.compareFunctionFront;
			passOp = state.passOperationFront;
			failOp = state.failOperationFront;
			zFailOp = state.zFailOperationFront;
		}

		public StencilSettingsModel(RenderObjects feature, int index)
		{
			var stencil = feature.settings.stencilSettings;
			var settings = feature.settings;

			this.name = feature.name;
			this.@event = (int)settings.Event;
			this.index = index;

			this.queue = (int)feature.settings.filterSettings.RenderQueueType;
			this.layer = feature.settings.filterSettings.LayerMask;

			this.value = stencil.stencilReference;
			this.compareFunc = stencil.stencilCompareFunction;
			this.passOp = stencil.passOperation;
			this.failOp = stencil.failOperation;
			this.zFailOp = stencil.zFailOperation;
		}
	}
}
#endif