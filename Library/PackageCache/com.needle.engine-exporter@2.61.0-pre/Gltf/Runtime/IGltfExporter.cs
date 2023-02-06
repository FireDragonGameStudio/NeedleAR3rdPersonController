using System;
using System.Threading.Tasks;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	public interface IGltfExportHandler
	{
		GltfExporterType Type { get; }
		Task<bool> OnExport(Transform t, string path, IExportContext ctx);
	}

	public static class GltfExportExtensions
	{
		public static bool IsExportType(this IExportContext ctx, GltfExporterType type)
		{
			if (ctx is GltfExportContext gltf)
			{
				return gltf.Handler.Type == type;
			}
			return false;
		}
	}

	public enum GltfExporterType
	{
		UnityGLTF = 0,
		GLTFast = 1,
	}

	public class GltfExportHandlerAttribute : Attribute
	{
		public GltfExporterType Type;

		public GltfExportHandlerAttribute(GltfExporterType type)
		{
			this.Type = type;
		}
	}
}