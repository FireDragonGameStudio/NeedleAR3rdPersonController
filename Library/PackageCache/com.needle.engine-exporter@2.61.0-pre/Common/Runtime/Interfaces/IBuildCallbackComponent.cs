
namespace Needle.Engine
{
	/// <summary>
	/// called by Builder after everything has been exported
	/// </summary>
	public interface IBuildCallbackComponent
	{
		void OnBuildCompleted();
	}
}