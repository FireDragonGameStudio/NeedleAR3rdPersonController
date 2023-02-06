using GLTF.Schema;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Gltf.UnityGltf
{
	public class UnityGltf_NEEDLE_gltf_dependencies : IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_gltf_dependencies";
		
		private readonly GltfExportContext context;
		private string OutputPath => context.Path;
		private IDependencyRegistry dependencies { get; }

		public UnityGltf_NEEDLE_gltf_dependencies(GltfExportContext context, IDependencyRegistry dependencies)
		{
			this.context = context;
			this.dependencies = dependencies;
		}
		
		public JProperty Serialize()
		{
			var obj = new JObject();
			var rel = dependencies.GetRelativeTo(OutputPath);
			var json = this.context.Serializer.Serialize(rel);
			var arr = JArray.Parse(json);
			obj.Add("dependencies", arr);
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new UnityGltf_NEEDLE_gltf_dependencies(this.context, this.dependencies);
		}
	}
}