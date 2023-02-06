using System.Collections.Generic;
using Needle.Engine.Gltf.Experimental;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	public class TextureSizeHandler : GltfExtensionHandlerBase, ITextureExportHandler
	{
		private TextureSizeSettings _textureSizeSettings;
		
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			TextureExportHandlerRegistry.Register(this);
			_textureSizeSettings = Object.FindObjectOfType<TextureSizeSettings>();
		}
		
		public bool OnTextureExport(GltfExportContext context, ref TextureExportSettings textureSettings, string textureSlot, List<object> extensions)
		{
			var changedSize = false;
			if (NeedleAssetSettingsProvider.TryGetTextureSettings(textureSettings.Texture, out var needleSettings) && needleSettings.Override)
			{
				// Set the texture max size for UnityGltf
				textureSettings.MaxSize = Mathf.Min(textureSettings.MaxSize, needleSettings.MaxSize);
				changedSize = true;
			}
			
			if (_textureSizeSettings && _textureSizeSettings.enabled)
			{
				if (_textureSizeSettings.MaxSize >= 4)
				{
					textureSettings.MaxSize = Mathf.Min(textureSettings.MaxSize, _textureSizeSettings.MaxSize);
					changedSize = true;
				}
			}
			return changedSize;
		}
	}
}