using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine
{
	/// <summary>
	/// Called on component serialization (in gltf extension) to add additional info to an existing component
	/// </summary>
	public interface IAdditionalComponentDataProvider
	{
		void OnSerialize(Component comp, List<(object key, object value)> additionalData);
	}
}