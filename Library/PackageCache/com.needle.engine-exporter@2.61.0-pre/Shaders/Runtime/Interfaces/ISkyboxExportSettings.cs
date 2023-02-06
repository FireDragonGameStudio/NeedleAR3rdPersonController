namespace Needle.Engine.Shaders
{
	public interface ISkyboxExportSettingsProvider
	{
		int SkyboxResolution { get; set; }
		bool HDR { get; set; }
	}
}