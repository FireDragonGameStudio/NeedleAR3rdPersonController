using Needle.Engine.Core.References.ReferenceResolvers;

namespace Needle.Engine.Interfaces
{
	public interface IBeforeExportGltf
	{
		bool OnBeforeExportGltf(string path, object instance, IExportContext context);
	}

	public static class BeforeExportGltfExtension
	{
		public static void Register(this IBeforeExportGltf instance)
		{
			GltfReferenceResolver.Register(instance);
		}
	}
}