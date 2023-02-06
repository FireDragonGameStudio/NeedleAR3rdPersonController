using System;
using System.Collections.Generic;
using System.IO;
using Needle.Engine.Projects;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	internal static class BundleProjectGen
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			ProjectGenerator.ReplacingVariablesInFile += OnReplacingVariables;
		}

		private static void OnReplacingVariables(string obj)
		{
			EnsureValidNpmDefPathsInPackageJson(obj);
		}

		private static void EnsureValidNpmDefPathsInPackageJson(string packageJsonPath)
		{
			if (packageJsonPath.EndsWith("package.json"))
			{
				if (PackageUtils.TryReadDependencies(packageJsonPath, out var deps))
				{
					var dir = Path.GetDirectoryName(packageJsonPath);
					var requireSave = false;
					var dependenciesToChange = new List<(string key, Bundle bundle)>();
					
					foreach (var dep in deps)
					{
						foreach (var bundle in BundleRegistry.Instance.Bundles)
						{
							if (bundle.FindPackageName() == dep.Key)
							{
								dependenciesToChange.Add((dep.Key, bundle));
							}
						}
					}

					foreach (var dep in dependenciesToChange)
					{
						requireSave = true;
						var path = Path.GetFullPath(dep.bundle.PackageDirectory);
						Debug.Log(path);
						deps[dep.key] = PackageUtils.GetFilePath(dir, path);
					}

					if (requireSave)
					{
						PackageUtils.TryWriteDependencies(packageJsonPath, deps);
					}
				}
			}
		}
	}
}