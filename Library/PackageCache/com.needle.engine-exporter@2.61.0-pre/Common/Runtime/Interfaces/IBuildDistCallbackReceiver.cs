using System.Threading.Tasks;

namespace Needle.Engine
{
	public interface IBuildDistCallbackReceiver
	{
		Task<bool> BeforeBuildDist(string projectDirectory, string outputDirectory);
	}
}