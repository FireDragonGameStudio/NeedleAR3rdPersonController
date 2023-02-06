using System.Collections.Generic;
using GLTF.Schema;
using Newtonsoft.Json.Linq;
using UnityEngine.Rendering.Universal;

namespace Needle.Engine.UniversalRenderPipeline
{
	public class NEEDLE_render_objects : IExtension
	{
		private readonly List<object> stencilModels;
		private readonly ISerializer serializer;
		public const string EXTENSION_NAME = "NEEDLE_render_objects";

		public void AddStencilModel(StencilSettingsModel stencil)
		{
			this.stencilModels.Add(stencil);
		}

		public NEEDLE_render_objects(ISerializer serializer)
		{
			this.stencilModels = new List<object>();
			this.serializer = serializer;
		}

		public JProperty Serialize()
		{
			var obj = new JObject();
			obj.Add("stencil", JArray.Parse(this.serializer.Serialize(this.stencilModels)));
			return new JProperty(EXTENSION_NAME, obj);;
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new NEEDLE_render_objects(serializer);
		}
	}
}