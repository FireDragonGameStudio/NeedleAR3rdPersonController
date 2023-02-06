using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	public interface IAssetExtension
	{
		bool CanAdd(object owner, Object asset);
		object GetPathOrAdd(Object asset, object owner, MemberInfo member);
		void AddExtension(IGltfBridge bridge);
	}
}