using System;
using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.Gltf.Experimental;
using Needle.Engine.Utils;
using UnityGLTF;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	[UsedImplicitly]
	public class TextureCompressionHandler : GltfExtensionHandlerBase, ITextureExportHandler
	{
		private static TextureCompressionSettings defaultCompressionSettings;

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			TextureExportHandlerRegistry.Register(this);
			if (!defaultCompressionSettings)
				defaultCompressionSettings = Object.FindObjectOfType<TextureCompressionSettings>();
		}

		public bool OnTextureExport(GltfExportContext context, ref TextureExportSettings textureSettings, string textureSlot, List<object> extensions)
		{
			var ext = Create(context, ref textureSettings, textureSlot);
			if (ext != null) extensions.Add(ext);
			return ext != null;
		}

		private static NEEDLE_compression_texture Create(IExportContext context, ref TextureExportSettings textureSettings, string textureSlot)
		{
#if UNITY_EDITOR
			if (!textureSettings.Texture) return null;

			if (NeedleAssetSettingsProvider.TryGetTextureSettings(textureSettings.Texture, out var needleSettings) && needleSettings.Override)
			{
				if (needleSettings.CompressionMode == TextureCompressionMode.None)
				{
					return null;
				}
				
				var mode = needleSettings.CompressionMode.Serialize();

				if (needleSettings.CompressionMode == TextureCompressionMode.Automatic)
					mode = GetCompressionModeFromSlot(textureSettings, textureSlot);

				if (mode != null)
				{
					var quality = needleSettings.CompressionQualitySupported ? (needleSettings.CompressionQuality / 100f) : -1;
					var settings = new NEEDLE_compression_texture(mode, textureSlot, quality);
					settings.maxSize = needleSettings.MaxSize;
					return settings;
				}
			}

			var texturePath = UnityEditor.AssetDatabase.GetAssetPath(textureSettings.Texture);
			if (!string.IsNullOrEmpty(texturePath))
			{
				// check asset tags
				var tags = UnityEditor.AssetDatabase.GetLabels(textureSettings.Texture);
				if (TryGetCompressionModeFromAssetLabels(tags, out var mode))
					return new NEEDLE_compression_texture(mode, textureSlot);

				if (UnityEditor.EditorUtility.IsPersistent(context.Root))
				{
					var rootTags = UnityEditor.AssetDatabase.GetLabels(context.Root);
					if (TryGetCompressionModeFromAssetLabels(rootTags, out mode))
						return new NEEDLE_compression_texture(mode, textureSlot);
				}

				// Export sprite textures using UASTC
				var importer = UnityEditor.AssetImporter.GetAtPath(texturePath) as UnityEditor.TextureImporter;
				if (importer && importer.textureType == UnityEditor.TextureImporterType.Sprite)
				{
					return new NEEDLE_compression_texture(TextureCompressionMode.UASTC.Serialize(), textureSlot);
				}
			}
#endif
			var compressionSettings = defaultCompressionSettings;
			
			if (!compressionSettings || !compressionSettings.enabled)
			{
				TryGetTextureCompressionSettings(context, out compressionSettings);
			}


			// use toktx settings when component does NOT exist or is enabled
			if (compressionSettings && compressionSettings.enabled)
			{
				// first try to see if the component wants to have some settings
				if (compressionSettings)
				{
					var settings = compressionSettings.GetSettings(context, textureSettings, textureSlot);
					if (settings.mode != null)
					{
						return new NEEDLE_compression_texture(settings.mode, textureSlot);
					}
				}

				// otherwise automatically determine mode by slot
				var mode = GetCompressionModeFromSlot(textureSettings, textureSlot);
				if (mode != null)
				{
					return new NEEDLE_compression_texture(mode, textureSlot);
				}
			}

			return null;
		}

		private static bool TryGetTextureCompressionSettings(IExportContext context, out TextureCompressionSettings settings)
		{
			// try find component in hierarchy of exported objects
			var level = 0;
			while (context != null && context.Root)
			{
				if (context.Root.TryGetComponent(out TextureCompressionSettings comp))
				{
					settings = comp;
					return true;
				}
				context = context.ParentContext;
				if (level++ > 99) break;
			}
			settings = null;
			return false;
		}

		private static bool TryGetCompressionModeFromAssetLabels(string[] labels, out string mode)
		{
			if (labels != null)
			{
				foreach (var tag in labels)
				{
					if (tag.Equals(TextureCompressionMode.UASTC.Serialize(), StringComparison.OrdinalIgnoreCase))
					{
						mode = TextureCompressionMode.UASTC.Serialize();
						return true;
					}
					if (tag.Equals(TextureCompressionMode.ETC1S.Serialize(), StringComparison.OrdinalIgnoreCase))
					{
						mode = TextureCompressionMode.ETC1S.Serialize();
						return true;
					}
					if (tag.Equals(TextureCompressionMode.WebP.Serialize(), StringComparison.OrdinalIgnoreCase))
					{
						mode = TextureCompressionMode.WebP.Serialize();
						return true;
					}
				}
			}
			mode = null;
			return false;
		}

		private static string GetCompressionModeFromSlot(TextureExportSettings textureExportSettings, string textureSlot)
		{
			switch (textureSlot)
			{
				case GLTFSceneExporter.TextureMapType.BaseColor:
				case GLTFSceneExporter.TextureMapType.Emissive:
				case GLTFSceneExporter.TextureMapType.Occlusion:
				case GLTFSceneExporter.TextureMapType.sRGB:
					return TextureCompressionMode.ETC1S.Serialize();

				case GLTFSceneExporter.TextureMapType.Normal:
				case GLTFSceneExporter.TextureMapType.MetallicRoughness:
				case GLTFSceneExporter.TextureMapType.Linear:
					return TextureCompressionMode.UASTC.Serialize();
			}

			// if we haven't catched the right slot above, we differentiate by linear setting
			if (textureExportSettings.Linear)
				return TextureCompressionMode.UASTC.Serialize();
			return TextureCompressionMode.ETC1S.Serialize();
		}
	}
}