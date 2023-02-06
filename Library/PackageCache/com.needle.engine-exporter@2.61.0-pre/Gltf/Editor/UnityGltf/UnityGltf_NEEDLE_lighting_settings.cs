using GLTF.Schema;
using JetBrains.Annotations;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace Needle.Engine.Gltf.UnityGltf
{
	[UsedImplicitly]
	public class UnityGltf_NEEDLE_lighting_settings : GltfExtensionHandlerBase, IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_lighting_settings";


		public JProperty Serialize()
		{
			var obj = new JObject();
			obj.Add(nameof(RenderSettings.ambientMode), new JValue(RenderSettings.ambientMode));
			if (RenderSettings.ambientMode == AmbientMode.Trilight)
			{
				var ambientColors = new[] { RenderSettings.ambientGroundColor, RenderSettings.ambientEquatorColor, RenderSettings.ambientSkyColor };
				var ambientColorArray = new JArray();
				foreach (var col in ambientColors)
				{
					var channels = new JArray();
					ambientColorArray.Add(channels);
					for(var i = 0; i < 4; i++) channels.Add(col[i]);
				}
				obj.Add("ambientTrilight", ambientColorArray);
			}
			{
				var c = RenderSettings.ambientLight;
				var channels = new JArray();
				for(var i = 0; i < 4; i++) channels.Add(c[i]);
				obj.Add(nameof(RenderSettings.ambientLight), channels);
			}
			obj.Add(nameof(RenderSettings.ambientIntensity), new JValue(RenderSettings.ambientIntensity));
			obj.Add("environmentReflectionSource", new JValue(RenderSettings.defaultReflectionMode));
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new UnityGltf_NEEDLE_lighting_settings();
		}

		public override void OnAfterExport(GltfExportContext context)
		{
			base.OnAfterExport(context);
			context.Bridge.AddExtension(EXTENSION_NAME, this);
		}
	}
}