// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public interface INeedleBuildPlatformGUIProvider
	{
		void OnGUI(NeedleEngineBuildOptions buildOptions);
	}

	public interface INeedleBuildPlatformFooterGUIProvider
	{
		void OnGUI(NeedleEngineBuildOptions buildOptions);
	}
}