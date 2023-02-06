using System;
using UnityGLTF;

namespace Needle.Engine.Gltf.UnityGltf
{
	internal static class Utils
	{
		public static TextureExportSettings FromUnique(this GLTFSceneExporter.UniqueTexture tex)
		{
			var textureSettings = new TextureExportSettings();
			textureSettings.Texture = tex.Texture;
			textureSettings.MaxSize = tex.MaxSize;
			return textureSettings;
		}
		public static void ApplyToUnique(this TextureExportSettings tex, ref GLTFSceneExporter.UniqueTexture obj)
		{
			obj.Texture = tex.Texture;
			obj.MaxSize = tex.MaxSize;
		}
	}
}