using UnityEngine;

namespace Needle.Engine.Gltf
{
	public interface IGltfComponentExportHandler
	{
		bool OnExportNode(GltfExportContext context, int nodeId, Component component);
	}
}