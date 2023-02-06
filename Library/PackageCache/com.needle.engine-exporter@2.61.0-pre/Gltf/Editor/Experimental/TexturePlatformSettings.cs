using System.Collections.Generic;
using Needle.Engine.Core.References.ReferenceResolvers;
using Needle.Engine.Utils;
using UnityEditor;

namespace Needle.Engine.Gltf.Experimental
{
	// register via static attribute to make sure it runs first
	[InitializeOnLoad] 
	public class TexturePlatformSettings : ITextureExportHandler
	{
		static TexturePlatformSettings()
		{
			TextureExportHandlerRegistry.Register(new TexturePlatformSettings());
		}
		
		public bool OnTextureExport(GltfExportContext context, ref TextureExportSettings textureSettings, string textureSlot, List<object> extensions)
		{
			if (EditorAssetUtils.TryGetTextureImporterSettings(textureSettings.Texture, out var settings))
			{
				textureSettings.MaxSize = settings.maxTextureSize;
				return true;
			}
			return false;
		}
	}
}