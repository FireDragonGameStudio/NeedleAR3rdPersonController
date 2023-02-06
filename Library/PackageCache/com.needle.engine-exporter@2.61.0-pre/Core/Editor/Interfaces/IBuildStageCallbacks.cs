using System.Threading.Tasks;
using Needle.Engine.Core;

namespace Needle.Engine.Interfaces
{
	public enum BuildStage
	{
		/// <summary>
		/// Invoked before any build is run or not run
		/// </summary>
		Setup,
		PreBuildScene,
		BeginSceneLoadFunction,
		EndSceneLoadFunction,
		PostBuildScene,
		BuildFailed,
	}

	public interface IBuildStageCallbacks
	{
		Task<bool> OnBuild(BuildStage stage, ExportContext context);
	}
}