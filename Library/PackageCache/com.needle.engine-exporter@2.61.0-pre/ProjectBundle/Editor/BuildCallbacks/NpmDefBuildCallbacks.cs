using System.Collections.Generic;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using Unity.Profiling;

namespace Needle.Engine.ProjectBundle
{
	[UsedImplicitly]
	public class NpmDefBuildCallbacks : IBuildStageCallbacks
	{
		private static ProfilerMarker preBuildMarker = new ProfilerMarker("NpmDef PreBuild Callbacks");
		private static ProfilerMarker postBuildMarker = new ProfilerMarker("NpmDef PostBuild Callbacks");

		private readonly IList<NpmDefBuildCallback> callbacks = new NpmDefBuildCallback[]
		{
			new ExportNpmDefAssets(),
			new InstallNpmdef(),
		};

		public async Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			switch (stage)
			{
				case BuildStage.PreBuildScene:
					using (preBuildMarker.Auto())
					{
						foreach (var installed in EnumerateReferencedBundles(context.ProjectDirectory))
						{
							foreach (var cb in callbacks)
							{
								var res = await cb.OnPreExport(context, installed);
								if (!res) return false;
							}
						}
					}
					break;

				case BuildStage.PostBuildScene:
					using (postBuildMarker.Auto())
					{
						foreach (var installed in EnumerateReferencedBundles(context.ProjectDirectory))
						{
							foreach (var cb in callbacks)
								await cb.OnPostExport(context, installed);
						}
					}
					break;
			}
			return true;
		}

		private static IEnumerable<Bundle> EnumerateReferencedBundles(string projectDir)
		{
			if (PackageUtils.TryReadDependencies(projectDir + "/package.json", out var deps))
			{
				foreach (var dep in deps)
				{
					if (BundleRegistry.TryGetBundle(dep.Key, out var b))
					{
						yield return b;
					}
				}
			}
		}
	}

	public abstract class NpmDefBuildCallback
	{
		public virtual Task<bool> OnPreExport(ExportContext context, Bundle npmDef)
		{
			return Task.FromResult(true);
		}

		public virtual Task OnPostExport(ExportContext context, Bundle npmDef)
		{
			return Task.CompletedTask;
		}
	}
}