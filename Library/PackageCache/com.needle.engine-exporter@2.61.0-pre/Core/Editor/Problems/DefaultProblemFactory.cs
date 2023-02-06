#nullable enable
using System.Collections.Generic;
using System.IO;
using JetBrains.Annotations;

namespace Needle.Engine.Problems
{
	[UsedImplicitly]
	[Priority(-10)]
	public class DefaultProblemFactory : IProblemFactory
	{
		public IEnumerable<IProblem> CreateProjectProblems(string packageJsonPath)
		{
			var gitignore = Path.GetDirectoryName(packageJsonPath) + "/.gitignore";
			if(!File.Exists(gitignore)) yield return new MissingGitIgnore("No gitignore file found", "missing-gitignore", gitignore);
			yield break;
		}

		public IProblem? CreatePackageProblem(string packageJsonPath, string packageJsonKey, string key, string value)
		{
			switch (packageJsonKey)
			{
				case "scripts":
					if (key == "pack-gltf" && value == "node node_modules/@needle-tools/engine/plugins/gltf-packer.mjs")
						return new OldGltfPackScript(packageJsonPath, packageJsonKey, key, value);
					break;
				
				case "devDependency":
				case "dependency":
					if (key == FoundOldPackageName.OldPackageName)
					{
						return new FoundOldPackageName(packageJsonPath, packageJsonKey, key, value, 
							"Found old name \"" + FoundOldPackageName.OldPackageName + "\" in " + packageJsonKey);
					}
			
					var dir = Path.GetDirectoryName(packageJsonPath);
					var modulesDir = $"{dir}/node_modules";
					var modulePath = $"{modulesDir}/{key}";
			
					if (!Directory.Exists(modulePath))
					{
						return new PackageNotInstalled(packageJsonPath, packageJsonKey, key, value);
					}
			
					var installedPackage = modulePath + "/package.json";
					if (!File.Exists(installedPackage))
					{
						return new MissingPackageJson(packageJsonPath, packageJsonKey, key, value);
					}
					break;
			}
			
			return null;
		}
	}
}