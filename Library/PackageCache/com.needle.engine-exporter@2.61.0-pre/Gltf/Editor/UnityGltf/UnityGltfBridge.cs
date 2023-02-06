using System.Collections.Generic;
using GLTF.Schema;
using Needle.Engine.Shaders;
using Needle.Engine.Utils;
using UnityEngine;
using UnityGLTF;

namespace Needle.Engine.Gltf.UnityGltf
{
	public class UnityGltfBridge : IGltfBridge
	{
		private readonly GLTFSceneExporter exporter;
		private readonly Dictionary<Mesh, MeshId> exportedMeshesMap = new Dictionary<Mesh, MeshId>();

		public UnityGltfBridge(GLTFSceneExporter exporter)
		{
			this.exporter = exporter;
		}

		public int TryGetNodeId(Transform t)
		{
			return exporter.GetTransformIndex(t);
		}

		public int TryGetMaterialId(Material mat)
		{
			return exporter.GetMaterialIndex(mat);
		}

		public int TryGetMeshId(Mesh m)
		{
			if (exportedMeshesMap.TryGetValue(m, out var id)) return id.Id;
			return -1;
		}

		// for cubemaps
		private readonly Dictionary<Texture, TextureId> textureMap = new Dictionary<Texture, TextureId>();

		public int TryGetTextureId(Texture tex)
		{
			var id = exporter.GetTextureId(exporter.GetRoot(), tex);
			if (id == null)
			{
				if (textureMap.TryGetValue(tex, out var tid)) return tid.Id;
				return -1;
			}
			return id.Id;
		}

		public int TryGetAnimationId(AnimationClip clip, Transform transform)
		{
			return exporter.GetAnimationId(clip, transform);
		}

		public bool AddTextureExtension<T>(int textureId, string name, T extension)
		{
			if (extension is IExtension ext)
			{
				AddExtensionUsed(name);
				var texture = exporter.GetRoot().Textures[textureId];
				texture.AddExtension(name, ext);
				return true;
			}
			return false;
		}

		public bool AddNodeExtension<TExtension>(int nodeId, string name, TExtension extension)
		{
			if (extension is IExtension ext)
			{
				AddExtensionUsed(name);
				var node = exporter.GetRoot().Nodes[nodeId];
				node.AddExtension(name, ext);
				return true;
			}
			return false;
		}

		public bool AddMaterialExtension<T>(int materialId, string name, T extension)
		{
			if (extension is IExtension ext)
			{
				AddExtensionUsed(name);
				var mat = this.exporter.GetRoot().Materials[materialId];
				mat.AddExtension(name, ext);
				return true;
			}
			return false;
		}

		public void AddExtension<TExtension>(string name, TExtension extension)
		{
			if (extension is IExtension ext)
			{
				AddExtensionUsed(name);
				this.exporter.GetRoot().AddExtension(name, ext);
			}
		}

		public void AddMaterial(Material material)
		{
			exporter.ExportMaterial(material);
		}

		public int AddMesh(Mesh mesh)
		{
			if (exportedMeshesMap.TryGetValue(mesh, out var id)) return id.Id;
			id = exporter.ExportMesh(mesh);
			if (id != null)
			{
				exportedMeshesMap.Add(mesh, id);
				return id.Id;
			}
			Debug.LogWarning("Exporting mesh failed", mesh);
			return -1;
		}

		public int AddTexture(Texture texture)
		{
			// we only do this when using reflection probes
			// because we can not export a cubemap right now with UnityGLTF
			var tex = texture;
			var didChange = false;
			if (texture is Cubemap cube)
			{
				TextureUtils.ValidateCubemapSettings(cube, TextureUtils.CubemapUsage.Unknown);
				var size = texture.width;
				using var cubemapExporter = new CubemapExporter(size, OutputFormat.EXR);
				var res = cubemapExporter.ConvertCubemapToEquirectTexture(cube, false);
				if (res)
				{
					res.name = cube.name;
					texture = res;
					didChange = true;
				}
			}

			// HDR textures can be added as EXR now
			var textureMapType = texture.IsHDR()
				? GLTFSceneExporter.TextureMapType.Custom_HDR
				: GLTFSceneExporter.TextureMapType.Custom_Unknown;
			var tid = exporter.ExportTexture(texture, textureMapType);

			// we only need to cache this for reflection probes/cubemap textures
			if (didChange && !textureMap.ContainsKey(tex))
				textureMap.Add(tex, tid);

			return tid.Id;
		}

		public int AddAnimationClip(AnimationClip clip, Transform transform, float speed)
		{
#if UNITY_EDITOR
			// FIXME: the name is just a hack until we have a proper timeline extension
			var anim = exporter.ExportAnimationClip(clip, clip.name, transform, speed);
			return exporter.GetRoot().Animations.IndexOf(anim);
#else
			return -1;
#endif
		}

		private void AddExtensionUsed(string name)
		{
			var root = this.exporter.GetRoot();
			if (root.ExtensionsUsed == null) root.ExtensionsUsed = new List<string>();
			if (!root.ExtensionsUsed.Contains(name)) root.ExtensionsUsed.Add(name);
		}
	}
}