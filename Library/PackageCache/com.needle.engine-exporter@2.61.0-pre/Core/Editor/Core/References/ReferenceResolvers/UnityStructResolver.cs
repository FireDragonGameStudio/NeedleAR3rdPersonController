using System;
using UnityEngine;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class UnityStructResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result)
		{
			if (value is Vector2 vector2)
			{
				result = $"new THREE.Vector2({vector2.x}, {vector2.y})";
				return true;
			}
			if (value is Vector3 vector3)
			{
				result = $"new THREE.Vector3({vector3.x}, {vector3.y}, {vector3.z})";
				return true;
			}
			if (value is Vector4 vector4)
			{
				result = $"new THREE.Vector4({vector4.x}, {vector4.y}, {vector4.z}, {vector4.w})";
				return true;
			}
			if (value is Quaternion quaternion)
			{
				result = $"new THREE.Quaternion({quaternion.x}, {quaternion.y}, {quaternion.z}, {quaternion.w})";
				return true;
			}
			if (value is Color color)
			{
				result = $"new engine.RGBAColor({color.r}, {color.g}, {color.b}, {color.a})";
				return true;
			}
			if (value is Enum en)
			{
				result = en.GetHashCode().ToString();
				return true;
			}
			result = null;
			return false;
		}
	}
}