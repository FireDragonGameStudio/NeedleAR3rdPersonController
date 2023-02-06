using UnityEngine;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// This component is only temporarily instantiated when a nested gltf is exported to automatically load this
	/// </summary>
	// empty path = hidden
	[AddComponentMenu("")]
	public class NestedGltf : MonoBehaviour
	{
		public string FilePath;
	}
}