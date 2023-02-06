using System.Collections.Generic;

namespace Needle.Engine.Gltf
{
	public static class TextureExportHandlerRegistry
	{
		// TODO: refactor this - TextureExportHandler should register with the gltf export context, currently we might get wrong handlers if we have nested exports!
		public static IReadOnlyList<ITextureExportHandler> List => textureHandlers;

		public static void BeforeExport()
		{
			textureHandlers.Clear();
		}

		// TODO: this architecture is a bit awkward, we currently create instances for GltfExtensionHandlerBase objects automatically but have to register ITextureExportHandler manually to not create two instances for something that needs to have one instance (e.g. for progressive loading we need both the texture callbacks as well as the gltf export callbacks to kickoff the export of the captures textures)
		public static void Register(ITextureExportHandler handler)
		{
			if (!textureHandlers.Contains(handler)) textureHandlers.Add(handler);
		}

		private static readonly List<ITextureExportHandler> textureHandlers = new List<ITextureExportHandler>();

	}
}