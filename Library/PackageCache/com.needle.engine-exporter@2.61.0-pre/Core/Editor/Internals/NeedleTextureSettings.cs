using System;
using System.ComponentModel;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	/// <summary>
	/// Container for asset settings, provides a abstraction over the Unity TextureSettings
	/// so we can have an easy way to access the same settings serialized either in a Gltf/fbx subasset
	/// or serialized via the Unity TextureImporter platform
	/// </summary>
	[Serializable]
	public struct NeedleTextureSettings : INeedleTextureSettingsGUIProvider
	{
		public bool Override;
		public int MaxSize;
		public TextureCompressionMode CompressionMode;
		public int CompressionQuality;
		public bool UseProgressiveLoading;
		public int ProgressiveLoadingSize;

		public bool CompressionQualitySupported => CompressionMode == TextureCompressionMode.WebP;

#if UNITY_EDITOR
		public void SetFromPlatformSettings(TextureImporterPlatformSettings settings)
		{
			this.Override = settings.overridden;
			this.MaxSize = settings.maxTextureSize;
			this.CompressionMode = (TextureCompressionMode)settings.textureCompression;
			this.CompressionQuality = settings.compressionQuality;
			this.UseProgressiveLoading = ((int)settings.androidETC2FallbackOverride).GetBit(0);

			var maxSizeBytes = BitConverter.GetBytes((int)settings.resizeAlgorithm);
			// the progressive loading byte
			var progressiveLoadingSizeIndex = maxSizeBytes[0];
			if (progressiveLoadingSizeIndex < progressiveLoadingSizes.Length)
				this.ProgressiveLoadingSize = progressiveLoadingSizes[progressiveLoadingSizeIndex];
			else this.ProgressiveLoadingSize = MaxSize;
		}

		public void ApplyTo(TextureImporterPlatformSettings settings, TextureImporter importer = null)
		{
			// we can not safely change the format because for some settings Unity will complain and not change settings anymore if we select a unsupported format
			settings.format = TextureImporterFormat.Automatic;
			settings.overridden = this.Override;
			settings.maxTextureSize = this.MaxSize;
			settings.textureCompression = (TextureImporterCompression)this.CompressionMode;
			settings.compressionQuality = this.CompressionQuality;
			settings.androidETC2FallbackOverride =
				(AndroidETC2FallbackOverride)((int)settings.androidETC2FallbackOverride).SetBit(0, this.UseProgressiveLoading);

			var progressiveLoadingSizeIndex = Array.IndexOf(progressiveLoadingSizes, this.ProgressiveLoadingSize);
			// var progressiveLoadingSizeBytes = BitConverter.GetBytes(this.ProgressiveLoadingSize);
			var combined = new byte[4];
			combined[0] = (byte)progressiveLoadingSizeIndex;
			settings.resizeAlgorithm = (TextureResizeAlgorithm)BitConverter.ToInt32(combined, 0);
			
			if(importer) importer.SetPlatformTextureSettings(settings);
		}

		public void OnGUI(TextureImporterPlatformSettings settings)
		{
			if (settings != null)
				SetFromPlatformSettings(settings);
			
			var changeScope = new EditorGUI.ChangeCheckScope();

			// if we dont have platform settings we are in a subasset and want to draw the max size
			if (settings == null)
			{
				Override = EditorGUILayout.ToggleLeft("Override for Needle Engine", Override);
				GUI.enabled = Override;
				
				using (new GUILayout.HorizontalScope())
				{
					EditorGUILayout.PrefixLabel(new GUIContent("Max Size", "The maximum size of the texture"));
					MaxSize = EditorGUILayout.IntPopup(MaxSize, maxSizesLabels, maxSizes);
				}
			}

			using (new EditorGUILayout.HorizontalScope())
			{
				this.CompressionMode = (TextureCompressionMode)EditorGUILayout.EnumPopup(new GUIContent("Compression"), this.CompressionMode);

				var hasHelp = this.CompressionMode != TextureCompressionMode.None && this.CompressionMode != TextureCompressionMode.Automatic;
				using (new EditorGUI.DisabledScope(!hasHelp))
				{
					if (GUILayout.Button("?", GUILayout.Width(20)))
					{
						switch (this.CompressionMode)
						{
							case TextureCompressionMode.UASTC:
								Application.OpenURL("https://github.com/BinomialLLC/basis_universal/wiki/UASTC-Texture-Specification");
								break;
							case TextureCompressionMode.ETC1S:
								Application.OpenURL("https://en.wikipedia.org/wiki/Ericsson_Texture_Compression");
								break;
							case TextureCompressionMode.WebP:
								Application.OpenURL("https://developers.google.com/speed/webp");
								break;
						}
					}
				}
			}

			switch (CompressionMode)
			{
				case TextureCompressionMode.WebP:
					this.CompressionQuality =
						EditorGUILayout.IntSlider(
							new GUIContent("Compression Quality", "The quality of the WebP compression. 0 is the lowest quality, 100 is the highest quality."),
							CompressionQuality, 0, 100);
					break;
			}

			GUILayout.Space(5);
			EditorGUILayout.LabelField("Progressive Loading", EditorStyles.boldLabel);
			// EditorGUI.indentLevel += 1;
			UseProgressiveLoading = EditorGUILayout.Toggle(
				new GUIContent("Load on Demand",
					"When enabled the full resolution texture will be loaded only when the object becomes visible. \n\nYou can use the setting below to set a maximum preview resolution for your texture. Using a low resolution will reduce the initial loading size of your scene. The highres texture will use the original resolution or the Max Size set above"),
				UseProgressiveLoading);
			using (new EditorGUI.DisabledScope(!UseProgressiveLoading))
			{
				ProgressiveLoadingSize =
					EditorGUILayout.IntPopup(
						new GUIContent("Max Preview Size",
							"If progressive loading is enabled this is the texture's preview size that is used until the high resolution texture is loaded"),
						ProgressiveLoadingSize, progressiveLoadingSizeLabels, progressiveLoadingSizes);
			}
			// EditorGUI.indentLevel -= 1;

			if (settings != null && changeScope.changed)
			{
				ApplyTo(settings);
			}

			GUILayout.Space(5);
			var wasEnabled = GUI.enabled;
			GUI.enabled = true;
			EditorGUILayout.LabelField("Learn More", EditorStyles.linkLabel);
			var lastRect = GUILayoutUtility.GetLastRect();
			if (Event.current.type == EventType.MouseDown && lastRect.Contains(Event.current.mousePosition))
			{
				Application.OpenURL("https://fwd.needle.tools/needle-engine/docs/texture-compression");
			}
			GUI.enabled = wasEnabled;
		}

		private static readonly int[] progressiveLoadingSizes = new int[] { 32, 64, 128, 256, 512, 1024, 2048 };
		private static readonly GUIContent[] progressiveLoadingSizeLabels = new GUIContent[]
		{
			new GUIContent("32"),
			new GUIContent("64"),
			new GUIContent("128"),
			new GUIContent("256"),
			new GUIContent("512"),
			new GUIContent("1024"),
			new GUIContent("2048")
		};
		private static readonly int[] maxSizes = new int[] { 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192 };
		private static readonly GUIContent[] maxSizesLabels = new GUIContent[]
		{
			new GUIContent("32"),
			new GUIContent("64"),
			new GUIContent("128"),
			new GUIContent("256"),
			new GUIContent("512"),
			new GUIContent("1024"),
			new GUIContent("2048"),
			new GUIContent("4096"),
			new GUIContent("8192"),
		};
#endif
	}

	public enum TextureCompressionMode
	{
		None = 0,
		Automatic = 1,
		WebP = 5,
		UASTC = 6,
		ETC1S = 7,
	}

	public static class NeedleTextureSettingsExtensions
	{
		public static string Serialize(this TextureCompressionMode mode)
		{
			switch (mode)
			{
				case TextureCompressionMode.Automatic:
					return null;
				case TextureCompressionMode.None:
					return "none";
				case TextureCompressionMode.WebP:
					return "webp";
				case TextureCompressionMode.UASTC:
					return "UASTC";
				case TextureCompressionMode.ETC1S:
					return "ETC1S";
			}
			return null;
		}
	}
}