using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class EditorAssetUtils
	{
		public static bool TryGetTextureImporterSettings(Texture tex, out TextureImporterPlatformSettings settings)
		{
			return TryGetTextureImporterSettings(tex, out settings, out _);
		}
		
		public static bool TryGetTextureImporterSettings(Texture tex, out TextureImporterPlatformSettings settings, out bool isOverriden)
		{
			return TryGetTextureImporterSettings(AssetDatabase.GetAssetPath(tex), out settings, out isOverriden);
		}

		public static bool TryGetTextureImporterSettings(string texturePath, out TextureImporterPlatformSettings settings, out bool isOverriden)
		{
			var importer = AssetImporter.GetAtPath(texturePath) as TextureImporter;
			if (importer)
			{
				settings = importer.GetPlatformTextureSettings(Constants.PlatformName);
				importer.SetPlatformTextureSettings(settings);
				isOverriden = settings?.overridden ?? false;
				if (settings == null) settings = importer.GetDefaultPlatformTextureSettings();
				return settings != null;
			}
			settings = null;
			isOverriden = false;
			return false;
		}

		public static bool TrySetTextureImporterSettings(string texturePath, TextureImporterPlatformSettings settings)
		{
			var importer = AssetImporter.GetAtPath(texturePath) as TextureImporter;
			if (importer)
			{
				settings = importer.GetPlatformTextureSettings(Constants.PlatformName);
				importer.SetPlatformTextureSettings(settings);
				return true;
			}
			return false;
		}
	}
}