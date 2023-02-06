using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Used for persistent assets to be serialized "late"
	/// </summary>
	public interface ISerializablePersistentAssetModel
	{
		void OnNewObjectDiscovered(Object asset, object owner, MemberInfo member, IExportContext context);
	}
}