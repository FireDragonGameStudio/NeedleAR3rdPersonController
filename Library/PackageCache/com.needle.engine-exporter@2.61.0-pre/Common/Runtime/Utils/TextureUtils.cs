using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class TextureUtils
	{
		public static bool IsHDR(this Texture texture)
		{
			if (texture is Texture2D texture2D)
			{
				switch (texture2D.format)
				{
					case TextureFormat.RGBAFloat:
					case TextureFormat.RGBAHalf:
					case TextureFormat.BC6H:
						return true;
				}
			}
			else if (texture is RenderTexture rt)
			{
				switch (rt.format)
				{
					case RenderTextureFormat.ARGBHalf:
					case RenderTextureFormat.ARGBFloat:
					case RenderTextureFormat.DefaultHDR:
						return true;
				}
			}
			// else if (texture is Cubemap cube)
			// {
			// 	switch (cube.format)
			// 	{
			// 		case TextureFormat.RGBAFloat:
			// 		case TextureFormat.RGBAHalf:
			// 		case TextureFormat.BC6H:
			// 			return true;
			// 	}
			// }
			return false;
		}

#if UNITY_EDITOR
		private static readonly TextureImporterSettings tempSettings = new TextureImporterSettings();
#endif

		public enum CubemapUsage
		{
			Skybox,
			CustomReflection,
			Unknown
		}
		
		/// <summary>
		/// Checks if a cubemap has correct settings, logs error if not and returns true if it is in a correct format
		/// </summary>
		/// <returns>True if the settings are OK</returns>
		public static bool ValidateCubemapSettings(Texture tex, CubemapUsage usage)
		{
#if UNITY_EDITOR
			if (usage == CubemapUsage.Skybox)
			{
				// Skybox is always ok
				return true;
			}
			if (tex is Cubemap cubemap)
			{
				var path = AssetDatabase.GetAssetPath(cubemap);
				if (!string.IsNullOrEmpty(path))
				{
					var importer = AssetImporter.GetAtPath(path) as TextureImporter;
					if (importer)
					{
						var settingsAreSupported = true;
						importer.ReadTextureSettings(tempSettings);
						
						switch (tempSettings.cubemapConvolution)
						{
							case TextureImporterCubemapConvolution.None:
							case TextureImporterCubemapConvolution.Specular:
								Debug.LogWarning($"<b>Cubemap \"{tex.name}\" is used for Image-Based Lighting but " +
								               $"has incorrect convolution mode</b> \"{tempSettings.cubemapConvolution}\" in Unity. " +
								               $"Results in the browser will look different. " +
								               $"Set to {TextureImporterCubemapConvolution.Diffuse} to get matching results.", tex);
								settingsAreSupported = false;
								break;
						}
						
						return settingsAreSupported;
					}
				}
			}
#endif

			return true;
		}
	}
}