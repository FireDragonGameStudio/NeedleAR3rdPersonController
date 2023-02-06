#nullable enable
using System.IO;

namespace Needle.Engine.Problems
{
	public class FoundOldPackageName : PackageJsonProblem
	{
		public const string OldPackageName = "needle.tiny.engine";
			
		public FoundOldPackageName(string packageJsonPath, string field, string key, string value, string message) 
			: base(packageJsonPath, field, key, value, message, null)
		{
			var dir = Path.GetDirectoryName(packageJsonPath);
			Fix = new CompoundFix(
				new ReplaceOldPackageNameInFileFix(packageJsonPath, OldPackageName), 
				new ReplaceOldPackageNameInFileFix(dir + "/vite.config.js", OldPackageName),
				new DeleteFileFix(dir + "/packages-lock.json"),
				new ReplaceOldImportsInCodeFilesFix(packageJsonPath, OldPackageName, Constants.RuntimeNpmPackageName),
				new InstallProjectFix()
				);
		}
	}
} 