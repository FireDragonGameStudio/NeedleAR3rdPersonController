
namespace Needle.Engine.Gltf.ImportSettings
{
	public class TextureSettings : AssetSettings
	{
		public NeedleTextureSettings Settings;

		public TextureSettings()
		{
			Settings.Override = false;
			Settings.ProgressiveLoadingSize = 128;
			Settings.MaxSize = 4096;
			Settings.CompressionQuality = 90;
		}

		internal override bool OnGUI()
		{
			Settings.OnGUI(null);
			return false;
		}
	}
}