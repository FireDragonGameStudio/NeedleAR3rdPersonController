using System;

namespace Needle.Engine.Shaders
{
	internal static class Utils
	{
		public static string GetNameWithoutPath(this UnityEngine.Shader shader)
		{
			var shaderName = shader.name;
			var actualNameStartIndex = shaderName.LastIndexOf("/", StringComparison.Ordinal);
			if (actualNameStartIndex > 0)
				shaderName = shaderName.Substring(actualNameStartIndex);
			return shaderName;
		}
	}
}