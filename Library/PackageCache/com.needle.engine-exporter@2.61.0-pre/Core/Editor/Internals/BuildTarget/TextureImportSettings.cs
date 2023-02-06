using UnityEditor;
using UnityEditor.Modules;
using UnityEngine;

namespace Needle.Engine
{
	internal class NeedleEngineTextureImportSettings : DefaultTextureImportSettingsExtension
	{
		private readonly INeedleTextureSettingsGUIProvider[] guiProvider;

		internal NeedleEngineTextureImportSettings()
		{
			guiProvider = InstanceCreatorUtil.CreateCollectionSortedByPriority<INeedleTextureSettingsGUIProvider>().ToArray();
		}

		private bool wasOverriden = false;

		public override void ShowImportSettings(BaseTextureImportPlatformSettings settings)
		{
			DrawMaxSize(settings);
			var enabled = GUI.enabled;
			// GUI.enabled = true;
			var platformSettings = settings.model.platformTextureSettings;

			if (platformSettings.overridden && !wasOverriden)
			{
				if(platformSettings.compressionQuality == 50) platformSettings.compressionQuality = 90;
			}
			wasOverriden = platformSettings.overridden;
			
			foreach (var prov in this.guiProvider)
			{
				prov.OnGUI(platformSettings);
			}
			GUI.enabled = enabled;
		}



		// private 

		#region Max Size
		private void DrawMaxSize(BaseTextureImportPlatformSettings settings)
		{
			EditorGUI.BeginChangeCheck();
			EditorGUI.showMixedValue = settings.model.maxTextureSizeIsDifferent;
			int maxTextureSize = EditorGUILayout.IntPopup(maxSize.text, settings.model.platformTextureSettings.maxTextureSize, kMaxTextureSizeStrings,
				kMaxTextureSizeValues);
			EditorGUI.showMixedValue = false;
			if (EditorGUI.EndChangeCheck())
				settings.model.SetMaxTextureSizeForAll(maxTextureSize);
		}

		private static readonly string[] kMaxTextureSizeStrings = new string[10]
		{
			"32",
			"64",
			"128",
			"256",
			"512",
			"1024",
			"2048",
			"4096",
			"8192",
			"16384"
		};

		private static readonly int[] kMaxTextureSizeValues = new int[10]
		{
			32,
			64,
			128,
			256,
			512,
			1024,
			2048,
			4096,
			8192,
			16384
		};

		private static readonly GUIContent maxSize = EditorGUIUtility.TrTextContent("Max Size", "Textures larger than this will be scaled down.");
		#endregion
	}
}