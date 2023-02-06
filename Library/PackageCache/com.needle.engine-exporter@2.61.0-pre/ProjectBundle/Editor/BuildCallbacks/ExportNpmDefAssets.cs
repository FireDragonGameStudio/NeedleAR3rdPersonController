using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Core;

namespace Needle.Engine.ProjectBundle
{
	public class ExportNpmDefAssets : NpmDefBuildCallback
	{
		// TODO: we currently only export assets locally installed (or known npmdefs) but we could also add a specific file type inside the package that marks which folders should be copied to the output directory to which path
		public override Task OnPostExport(ExportContext context, Bundle npmDef)
		{
			var assetsDirectory = npmDef.PackageDirectory + "/assets";
			var targetDirectory = context.Project.AssetsDirectory;
			CopyRecursive(new DirectoryInfo(assetsDirectory), new DirectoryInfo(targetDirectory));
			return Task.CompletedTask;
		}

		private static void CopyRecursive(DirectoryInfo source, DirectoryInfo target)
		{
			if (!source.Exists) return;
			if(!target.Exists) target.Create();
			foreach (var file in source.EnumerateFiles())
			{
				var targetPath = $"{target}/{file.Name}";
				File.Copy(file.FullName, targetPath, true);
			}
			foreach (var dir in source.EnumerateDirectories())
			{
				CopyRecursive(dir, new DirectoryInfo(target.FullName + "/" + dir.Name));
			}
		}
	}
}