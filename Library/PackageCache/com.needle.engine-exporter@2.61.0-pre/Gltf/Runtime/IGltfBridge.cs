using UnityEngine;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Methods to interop with exporters for UnityGLTF and potentially GLTFast once we add support for that
	/// </summary>
	public interface IGltfBridge
	{
		int TryGetNodeId(Transform t);
		int TryGetMaterialId(Material mat);
		int TryGetMeshId(Mesh m);
		int TryGetTextureId(Texture tex);
		int TryGetAnimationId(AnimationClip clip, Transform transform);
		bool AddTextureExtension<T>(int textureId, string name, T extension);
		bool AddNodeExtension<TExtension>(int nodeId, string name, TExtension extension);
		bool AddMaterialExtension<T>(int materialId, string name, T extension);
		void AddExtension<TExtension>(string name, TExtension extension);
		void AddMaterial(Material material);
		int AddMesh(Mesh mesh);
		int AddTexture(Texture texture);
		int AddAnimationClip(AnimationClip clip, Transform transform, float speed);
	}
}