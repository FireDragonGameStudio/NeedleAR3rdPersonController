using UnityEngine;

namespace Needle.Engine.Core.Converters
{
	public class ThreeJsConverter : IJavascriptConverter
	{
		public bool TryConvertToJs(object value, out string js)
		{
			switch (value)
			{
				case Vector2 v2:
					js = $"new THREE.Vector2({v2.x}, {v2.y})";
					return true;
				case Vector3 v3:
					js = $"new THREE.Vector3({v3.x}, {v3.y}, {v3.z})";
					return true;
				case Vector4 v4:
					js = $"new THREE.Vector4({v4.x}, {v4.y}, {v4.z}, {v4.w})";
					return true;
				case Quaternion qat:
					js = $"new THREE.Quaternion({qat.x}, {qat.y}, {qat.z}, {qat.w})";
					return true;
			}

			js = null;
			return false;
		}
	}
}