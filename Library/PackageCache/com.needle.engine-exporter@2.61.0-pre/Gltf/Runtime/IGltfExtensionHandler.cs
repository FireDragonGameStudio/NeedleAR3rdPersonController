using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Implement to receive gltf export callbacks
	/// </summary>
	public interface IGltfExtensionHandler
	{
		void OnBeforeExport(GltfExportContext context);
		// void OnBeforeNodeExport(GltfExportContext context, Transform transform);
		void OnAfterNodeExport(GltfExportContext context, Transform transform, int nodeId);
		void OnAfterExport(GltfExportContext context);
		void OnBeforeMaterialExport(GltfExportContext context, Material material, int materialId);
		void OnAfterMaterialExport(GltfExportContext context, Material material, int materialId);
		void OnBeforeTextureExport(GltfExportContext context, ref TextureExportSettings settings, string textureSlot);
		void OnAfterTextureExport(GltfExportContext context, int id, TextureExportSettings settings);
		/// <summary>
		/// Callback when serializing a mesh
		/// </summary>
		/// <param name="context"></param>
		/// <param name="mesh"></param>
		/// <param name="extensions">Add an instance of the extension to be added to the primitive</param>
		void OnAfterMeshExport(GltfExportContext context, Mesh mesh, List<object> extensions);
		void OnExportFinished(GltfExportContext context);
		void OnCleanup();
	}
}