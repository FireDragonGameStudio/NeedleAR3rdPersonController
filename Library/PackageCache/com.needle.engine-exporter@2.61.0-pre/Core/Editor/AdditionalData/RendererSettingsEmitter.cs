using System.Collections.Generic;
using System.Linq;
using JetBrains.Annotations;
using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	[UsedImplicitly]
	public class RendererSettingsEmitter : BaseAdditionalData
	{
		public override void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData)
		{
			if (instance is Renderer rend && rend.sharedMaterials != null && rend.sharedMaterials.Length > 0)
			{
				var instancing = rend.sharedMaterials.Select(s => s && s.enableInstancing).ToArray();
				additionalData.Add(("enableInstancing", instancing));

				var order = rend.sharedMaterials.Select(s =>
				{
					if (!s) return 0;
					var order = s.renderQueue;
					if (order >= 2750) order -= 3000; // Transparent +- 250
					else if (order >= 2250) order -= 2500; // Cutout +- 250
					else if (order >= 1750) order -= 2000; // Opaque +- 250
					return order;
				}).ToArray();
				additionalData.Add(("renderOrder", order));
			}
		}
	}
}