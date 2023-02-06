using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	public static class Assets
	{
		private static Texture2D glitchRemixIcon = null;

		public static Texture2D GlitchRemixIcon
		{
			get
			{
				if (!glitchRemixIcon)
					glitchRemixIcon = AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath(@"e42e7092484fddc4f97ff5b33ba54620"));
				return glitchRemixIcon;
			}
		}
	}
}