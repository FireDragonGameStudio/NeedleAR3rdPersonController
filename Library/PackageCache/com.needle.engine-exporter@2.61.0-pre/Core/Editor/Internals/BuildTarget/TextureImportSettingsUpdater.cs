using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal static class TextureImportSettingsUpdater
	{
		[MenuItem("Needle Engine/Internal/" + nameof(UpdateTextureSettingsFromPreviousBuildTarget), priority = 100_000)]
		private static void UpdateTextureSettingsFromPreviousBuildTarget()
		{
			var sourceTarget = BuildTarget.Lumin.ToString();
			var currentTarget = BuildPlatformConstants.BuildTarget.ToString();
			if(currentTarget == sourceTarget)
			{
				Debug.LogWarning("Nothing to update - current platform is source platform: " + currentTarget);
				return;
			}
			
			var textures = AssetDatabase.FindAssets("t:texture");
			Debug.Log("Found " + textures.Length + " textures.");
			var updatedCount = 0;
			foreach(var guid in textures)
			{
				var path = AssetDatabase.GUIDToAssetPath(guid);
				var importer = AssetImporter.GetAtPath(path) as TextureImporter;
				if(importer == null) continue;
				var sourceSettings = importer.GetPlatformTextureSettings(sourceTarget);
				if(sourceSettings == null) continue;
				if (sourceSettings.overridden == false) continue;
				var settings = importer.GetPlatformTextureSettings(sourceTarget);
				settings.name = currentTarget;
				importer.SetPlatformTextureSettings(settings);
				AssetDatabase.WriteImportSettingsIfDirty(path);
				updatedCount += 1;
			}
			Debug.Log("Updated " + updatedCount + " textures");
		}
	}
}