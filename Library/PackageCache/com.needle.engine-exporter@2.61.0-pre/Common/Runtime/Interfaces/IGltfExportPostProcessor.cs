using GLTF.Schema;
using UnityGLTF;

namespace Needle.Engine
{
	public interface IGltfExportPostProcessor
	{
		void OnPostProcess(GLTFSceneExporter exporter, GLTFRoot root);
	}
}