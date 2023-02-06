using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Base implementation for convenient selective override
	/// </summary>
	public abstract class GltfExtensionHandlerBase : IGltfExtensionHandler
	{
		public virtual void OnBeforeExport(GltfExportContext context)
		{
		}

		// public void OnBeforeNodeExport(GltfExportContext context, Transform transform)
		// {
		// 	
		// }

		public virtual void OnAfterNodeExport(GltfExportContext context, Transform transform, int nodeId)
		{
		}

		public virtual void OnBeforeMaterialExport(GltfExportContext context, Material material, int materialId)
		{
			
		}

		public virtual void OnAfterMaterialExport(GltfExportContext context, Material material, int materialId)
		{
		}

		public virtual void OnBeforeTextureExport(GltfExportContext context, ref TextureExportSettings settings, string textureSlot)
		{
		}

		public virtual void OnAfterTextureExport(GltfExportContext context, int id, TextureExportSettings settings)
		{
		}

		public virtual void OnAfterMeshExport(GltfExportContext context, Mesh mesh, List<object> extensions)
		{
			
		}

		/// <summary>
		/// Is called before serialize
		/// </summary>
		/// <param name="context"></param>
		public virtual void OnAfterExport(GltfExportContext context)
		{
		}

		/// <summary>
		/// Is called when all export has been completed
		/// </summary>
		/// <param name="context"></param>
		public virtual void OnExportFinished(GltfExportContext context)
		{
			
		}

		public virtual void OnCleanup()
		{
		}
	}
}