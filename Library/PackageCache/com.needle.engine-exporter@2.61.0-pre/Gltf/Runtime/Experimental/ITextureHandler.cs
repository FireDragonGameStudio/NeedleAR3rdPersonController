using System;
using System.Collections.Generic;
using System.IO;
using Needle.Engine.Utils;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Implement to override how a texture is exported and optionally provide a extension being added to the texture
	/// </summary>
	public interface ITextureExportHandler
	{
		bool OnTextureExport(GltfExportContext context, ref TextureExportSettings textureSettings, string textureSlot, List<object> extensions);
	}
}