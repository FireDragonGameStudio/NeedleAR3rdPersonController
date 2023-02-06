#if UNITY_EDITOR
using UnityEditor;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public static class PlayerSettingsAccess
	{
		public static bool IsLightmapEncodingSetToNormalQuality()
		{
			var encoding = PlayerSettings.GetLightmapEncodingQualityForPlatformGroup(EditorUserBuildSettings.activeBuildTargetGroup);
			return encoding == LightmapEncodingQuality.Normal;
		}

		public static string GetLightmapEncodingSettingName()
		{
			var encoding = PlayerSettings.GetLightmapEncodingQualityForPlatformGroup(EditorUserBuildSettings.activeBuildTargetGroup);
			return encoding.ToString();
		}

		public static int GetLightmapEncodingSetting()
		{
			return (int)PlayerSettings.GetLightmapEncodingQualityForPlatformGroup(EditorUserBuildSettings.activeBuildTargetGroup);
		}

		public static void SetLightmapEncodingToNormalQuality()
		{
			PlayerSettings.SetLightmapEncodingQualityForPlatformGroup(EditorUserBuildSettings.activeBuildTargetGroup, LightmapEncodingQuality.Normal);
		}

		public static void SetLightmapEncodingQuality(int encoding)
		{
			PlayerSettings.SetLightmapEncodingQualityForPlatformGroup(EditorUserBuildSettings.activeBuildTargetGroup, (LightmapEncodingQuality) encoding);
			
		}
	}
}
#endif