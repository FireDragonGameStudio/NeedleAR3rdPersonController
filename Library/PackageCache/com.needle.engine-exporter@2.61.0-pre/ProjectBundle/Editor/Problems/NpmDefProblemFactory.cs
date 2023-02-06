using System.Collections.Generic;
using System.IO;
using System.Linq;
using JetBrains.Annotations;
using Needle.Engine.Problems;
using Needle.Engine.Utils;

namespace Needle.Engine.ProjectBundle.Problems
{
	[UsedImplicitly]
	public class NpmDefProblemFactory : IProblemFactory
	{
		// three or our runtime engine dont exist in npmdef files
		private readonly string[] ignore = new[] { Engine.Constants.RuntimeNpmPackageName, "three" };

		public IEnumerable<IProblem> CreateProjectProblems(string packageJsonPath)
		{
			yield break;
		}

		public IProblem CreatePackageProblem(string packageJsonPath, string packageJsonKey, string key, string value)
		{
			// we only care about problems that are related to local packages that are hidden npmdef packages
			if (value.EndsWith("~") == false) return null;
			if (ignore.Contains(key)) return null;
			var dir = Path.GetDirectoryName(packageJsonPath);
			if (PackageUtils.TryGetPath(dir, value, out var path))
			{
				// oh no looks like the path doesnt exist anymore
				if (!Directory.Exists(path))
				{
					return new MissingNpmDef(packageJsonPath, packageJsonKey, key, value);
				}

				var npmDefPackageJsonPath = path + "/package.json";
				if (File.Exists(npmDefPackageJsonPath))
				{
					var content = File.ReadAllText(npmDefPackageJsonPath);
					if (content.Contains(FoundOldPackageName.OldPackageName))
					{
						return new FoundOldPackageName(npmDefPackageJsonPath, "", FoundOldPackageName.OldPackageName, "", 
							"Found old name \"" + FoundOldPackageName.OldPackageName + "\" in " + packageJsonKey);
					}
				}
			}

			return null;
		}
	}
}