using GLTF.Schema;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Gltf.UnityGltf
{
	public readonly struct UnityGltfOpaqueExtension : IExtension
	{
		private readonly string name;
		private readonly JObject obj;

		public UnityGltfOpaqueExtension(string name, JObject obj)
		{
			this.name = name;
			this.obj = obj;
		}

		public JProperty Serialize()
		{
			return new JProperty(name, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new UnityGltfOpaqueExtension(name, obj);
		}
	}
}