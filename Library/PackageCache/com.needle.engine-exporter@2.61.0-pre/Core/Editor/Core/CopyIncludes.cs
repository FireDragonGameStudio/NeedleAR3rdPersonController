using System.IO;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Core
{
	[UsedImplicitly]
	public class CopyIncludes : IBuildStageCallbacks
	{
		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			if (stage == BuildStage.PostBuildScene)
			{
				using (new Timer("Copying additional files"))
					return ProcessHelper.RunCommand("npm run copy-files", Path.GetFullPath(context.ProjectDirectory), null, true, false);
			}

			return Task.FromResult(true);
		}
	}
}