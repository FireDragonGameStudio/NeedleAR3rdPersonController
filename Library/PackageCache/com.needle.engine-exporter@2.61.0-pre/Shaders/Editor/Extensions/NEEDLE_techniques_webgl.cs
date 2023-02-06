using GLTF.Schema;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Shaders.Extensions
{
	public class NEEDLE_techniques_webgl : IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_techniques_webgl";

		private readonly ExtensionData extensionData;

		public NEEDLE_techniques_webgl(ExtensionData extensionData)
		{
			this.extensionData = extensionData;
		}

		public JProperty Serialize()
		{
			var json = JsonConvert.SerializeObject(extensionData);
			return new JProperty(EXTENSION_NAME, new JRaw(json));
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new NEEDLE_techniques_webgl(extensionData);
		}
	}
}