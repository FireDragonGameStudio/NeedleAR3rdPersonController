using UnityEditor;

namespace Needle.Engine
{
	public interface INeedleTextureSettingsGUIProvider
	{
#if UNITY_EDITOR
		void OnGUI(TextureImporterPlatformSettings settings);
#endif
	}
}