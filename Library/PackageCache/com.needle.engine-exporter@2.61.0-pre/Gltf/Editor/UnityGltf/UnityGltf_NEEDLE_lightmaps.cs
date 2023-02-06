using System.Collections.Generic;
using GLTF.Schema;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Gltf.UnityGltf
{
	public class UnityGltf_NEEDLE_lightmaps : IExtension, ILightmapExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_lightmaps";
		

		public void RegisterData(LightmapData lightmapData)
		{
			this.data.Add(lightmapData);
		}
		

		private readonly GltfExportContext context;
		private readonly List<LightmapData> data = new List<LightmapData>();

		public UnityGltf_NEEDLE_lightmaps(GltfExportContext context)
		{
			this.context = context;
		}

		public JProperty Serialize()
		{
			JToken content = default;
			var json = context.Serializer.Serialize(data);
			if (json.StartsWith("{")) content = JObject.Parse(json);
			else if (json.StartsWith("[")) content = JArray.Parse(json);
			var obj = new JObject();
			obj.Add("textures", content);
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			var clone = new UnityGltf_NEEDLE_lightmaps(this.context);
			clone.data.AddRange(this.data);
			return clone;
		}
	}
}