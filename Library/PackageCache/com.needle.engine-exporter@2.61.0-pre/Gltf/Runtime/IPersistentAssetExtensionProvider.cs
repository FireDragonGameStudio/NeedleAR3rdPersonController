using UnityEngine;

namespace Needle.Engine.Gltf
{
	public interface IPersistentAssetExtensionProvider
	{
		string AddCustomExtension(GltfExportContext context, object owner, Object value);
	}
}