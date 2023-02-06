using Needle.Engine.Gltf.ImportSettings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public static class NeedleAssetSettingsProvider
	{
		public static bool TryGetTextureSettings(string texturePath, out NeedleTextureSettings settings)
		{
			if (EditorAssetUtils.TryGetTextureImporterSettings(texturePath, out var platformSettings, out _))
			{
				settings = new NeedleTextureSettings();
				settings.SetFromPlatformSettings(platformSettings);
				return true;
			}
			settings = default;
			return false;
		}

		public static bool TryGetTextureSettings(Texture tex, out NeedleTextureSettings settings)
		{
			if (NeedleAssetSettings.TryGetSettings(tex, out var res))
			{
				if (res is TextureSettings texSettings)
				{
					settings = texSettings.Settings;
					return true;
				}
			}
			
			if (EditorAssetUtils.TryGetTextureImporterSettings(tex, out var platformSettings, out _))
			{
				settings = new NeedleTextureSettings();
				settings.SetFromPlatformSettings(platformSettings);
				return true;
			}
			
			settings = default;
			return false;
		}

		public static bool TrySetTextureSettings(string path, NeedleTextureSettings settings, TextureImporter importer = null)
		{
			if (EditorAssetUtils.TryGetTextureImporterSettings(path, out var platformSettings, out _))
			{
				if(importer == null) importer = AssetImporter.GetAtPath(path) as TextureImporter;
				settings.ApplyTo(platformSettings, importer);
				return true;
			}
			if (NeedleAssetSettings.Settings != null)
			{
				foreach (var i in NeedleAssetSettings.Settings)
				{
					if (AssetDatabase.GetAssetPath(i) == path)
					{
						i.SetSettings(settings);
						return true;
					}
				}
			}
			return false;
		}

		public static bool TrySetTextureSettings(Texture tex, NeedleTextureSettings settings, TextureImporter importer = null)
		{
			if(EditorAssetUtils.TryGetTextureImporterSettings(tex, out var platformSettings, out _))
			{
				if (importer == null)
				{
					var path = AssetDatabase.GetAssetPath(tex);
					if(!string.IsNullOrEmpty(path))
						importer = AssetImporter.GetAtPath(path) as TextureImporter;
				}
				settings.ApplyTo(platformSettings, importer);
				return true;
			}
			if (NeedleAssetSettings.TryGetSettings(tex, out var res))
			{
				if (res is TextureSettings texSettings)
				{
					texSettings.Settings = settings;
					return true;
				}
			}
			return false;
		}

		
		
		// Mesh:
		
		public static bool TryGetMeshSettings(Mesh mesh, out MeshSettings settings)
		{
			if (NeedleAssetSettings.TryGetSettings(mesh, out var res))
			{
				if (res is MeshSettings meshSettings)
				{
					settings = meshSettings;
					return true;
				}
			}

			settings = null;
			return false;
		}
	}
}