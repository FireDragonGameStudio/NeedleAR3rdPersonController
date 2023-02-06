using System;
using System.IO;
using GLTF.Schema;
using Newtonsoft.Json.Linq;
using Unity.Profiling;
using UnityEditor;
using UnityEngine;
using UnityGLTF;
using Object = UnityEngine.Object;

namespace Needle.Engine.Utils
{
	public class GltfExportOptions
	{
		// public GLTFSceneExporter.BeforeNodeExportDelegate beforeNodeExport;
		public GLTFSceneExporter.AfterNodeExportDelegate afterNodeExport;
		public Action<GLTFSceneExporter, GLTFRoot> afterExport = null;
	}

	public static class ExportUtils
	{
		public static GLTFSceneExporter GetExporter(Transform transform, out ExportOptions exportOptions, GltfExportOptions options = null, GLTFSettings gltfExportSettings = null)
		{ 
			exportOptions = new ExportOptions(gltfExportSettings);
			exportOptions.TexturePathRetriever = RetrieveTexturePath;

			exportOptions.AfterSceneExport = (exp, root) =>
			{
				OnAfterExport(transform, exp, root);
				options?.afterExport?.Invoke(exp, root);
			};

			if (options != null)
			{
				// if (options.beforeNodeExport != null)
				// 	exportOptions.BeforeNodeExport = options.beforeNodeExport;
				if (options.afterNodeExport != null)
					exportOptions.AfterNodeExport = options.afterNodeExport;
			}

			var exporter = new GLTFSceneExporter(new[] { transform }, exportOptions);
			return exporter;
		}

		private static ProfilerMarker exportWithUnityGltfMarker = new ProfilerMarker("ExportWithUnityGltf");

		public static void ExportWithUnityGltf(GLTFSceneExporter exporter, string path, bool exportBinary = true)
		{
			using (exportWithUnityGltfMarker.Auto())
			{
				var dir = Path.GetDirectoryName(path);
				if (dir == null) throw new Exception("Directory is null?");
				if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
				var fileName = Path.GetFileName(path);
				// if(exportAdditionalTextures != null)
				// 	exporter.ExportAdditionalTexture += exportAdditionalTextures;
				if (exportBinary)
					exporter.SaveGLB(dir, fileName);
				else
					exporter.SaveGLTFandBin(dir, fileName);
			}
		}

		private static string RetrieveTexturePath(Texture texture)
		{
#if UNITY_EDITOR
			return AssetDatabase.GetAssetPath(texture);
#else
			return null;
#endif
		}

		private static void OnAfterExport(Transform transform, GLTFSceneExporter exporter, GLTFRoot root)
		{
			// add guid to exported transform nodes
			ApplyGuidToTransforms(transform);

			void ApplyGuidToTransforms(Transform tr)
			{
				var id = exporter.GetTransformIndex(tr);
				if (id < 0) return;
				var node = root.Nodes[id];
				Debug.Assert(node.Name == tr.name);
				AppendGuid(node, tr);
				foreach (Transform ch in tr) ApplyGuidToTransforms(ch);
			}

			// add guid to exported textures
			for (var index = 0; index < root.Textures.Count; index++)
			{
				var img = root.Textures[index];
				var tex = exporter.GetTexture(index);
				AppendGuid(img, tex);
				AppendGuid(img.Source.Value, tex);
			}
		}

#if UNITY_EDITOR
		private static bool TryGetImporter<T>(Object obj, out T importer) where T : AssetImporter
		{
			if (EditorUtility.IsPersistent(obj))
			{
				var texturePath = AssetDatabase.GetAssetPath(obj);
				importer = AssetImporter.GetAtPath(texturePath) as T;
				return importer;
			}
			importer = null;
			return false;
		}
#endif

		private static void AppendGuid(GLTFProperty prop, Object obj)
		{
			prop.Extras ??= new JObject();
#if UNITY_EDITOR
			prop.Extras["guid"] = obj.GetId();
#else
			prop.Extras["guid"] = obj.GetInstanceID();
#endif
		}
	}
}