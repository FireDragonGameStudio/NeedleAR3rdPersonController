using System;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	public class InstallNpmdef : NpmDefBuildCallback
	{
		public override async Task<bool> OnPreExport(ExportContext context, Bundle npmDef)
		{
			if (npmDef == null) return true;
			var packageJson = npmDef.PackageFilePath;
			if (File.Exists(packageJson))
			{
				var name = npmDef.FindPackageName();
				var packageDir = npmDef.PackageDirectory;
				// We need to make sure the npmdef packages are installed when building for distribution
				// sometimes we get typescript errors otherwise or vite rollup problems - maybe because local paths changes when working on different machines and/or updating packages where the folder path changes
				var needsInstallation = NeedsDistributionInstallation(packageDir, name, context.BuildContext)
				                        || NeedsInstallation(name, packageDir, packageJson, "dependencies")
				                        || NeedsInstallation(name, packageDir, packageJson, "devDependencies");
				if (needsInstallation)
				{
					var start = DateTime.Now;
					Debug.Log("<b>Install NpmDef Package</b>: " + name + " in " + packageDir);
					var res = await Actions.InstallBundleTask(npmDef);
					if (res) UpdateInstallationHash(packageDir, name);
					var duration = (DateTime.Now - start).TotalSeconds;
					if (!res)
					{
						Debug.LogError($"Installation failed for {name} in {packageDir} after {duration:0.0} seconds");
					}
					else
					{
						Debug.Log($"Installation completed of {name} in {duration:0.0} seconds");
					}
				}
			}

			return true;
		}

		private static bool NeedsInstallation(string bundleName, string packageDirectory, string packageJsonPath, string packageJsonKey)
		{
			var modulesDir = packageDirectory + "/node_modules";
			if (!Directory.Exists(modulesDir)) return true;
			// if any package in this directory is not installed, return true to trigger an installation
			if (PackageUtils.TryReadDependencies(packageJsonPath, out var dependencies, packageJsonKey))
			{
				foreach (var key in dependencies.Keys)
				{
					if (!Directory.Exists(modulesDir + "/" + key))
					{
						Debug.Log("Found missing dependency " + key + " in \"" + bundleName + "\" package at " + packageDirectory.AsLink());
						return true;
					}
				}
			}
			return false;
		}


		private static bool NeedsDistributionInstallation(string directory, string packageName, BuildContext context)
		{
			if (!context.IsDistributionBuild) return false;

			try
			{
				var node_modulesDirectory = directory + "/node_modules";
				if (Directory.Exists(node_modulesDirectory))
				{
					var hash = CalculateInstallationHash(directory);
					if (!string.IsNullOrEmpty(hash))
					{
						var hashLocation = GetHashLocation(directory, packageName);
						if (File.Exists(hashLocation))
						{
							var oldHash = File.ReadAllText(hashLocation);
							var changed = oldHash != hash;
							return changed;
						}
					}
				}
			}
			catch (Exception)
			{
				// ignore
			}

			return true;
		}

		private static void UpdateInstallationHash(string directory, string packageName)
		{
			try
			{
				var node_modulesDirectory = directory + "/node_modules";
				if (Directory.Exists(node_modulesDirectory))
				{
					var hash = CalculateInstallationHash(directory);
					if (!string.IsNullOrEmpty(hash))
					{
						var hashLocation = GetHashLocation(directory, packageName);
						File.WriteAllText(hashLocation, hash);
					}
				}
			}
			catch (Exception)
			{
				// ignore
			}
		}

		private static string CalculateInstallationHash(string directory)
		{
			var packageJsonPath = directory + "/package.json";
			var node_modulesDirectory = directory + "/node_modules";
			if (File.Exists(packageJsonPath) && Directory.Exists(node_modulesDirectory))
			{
				var str = File.ReadAllText(packageJsonPath);
				var lockPath = directory + "/package-lock.json";
				if (File.Exists(lockPath)) str += File.ReadAllText(lockPath);
				var hash = Hash128.Compute(str).ToString();
				return hash;
			}
			return "";
		}

		private static string GetHashLocation(string directory, string packageName)
		{
			var node_modulesDirectory = directory + "/node_modules";
			if (Directory.Exists(node_modulesDirectory))
			{
				var hash = CalculateInstallationHash(directory);
				if (!string.IsNullOrEmpty(hash))
				{
					var hashDirectory = node_modulesDirectory + "/@needle-tools/cache~";
					Directory.CreateDirectory(hashDirectory);
					var hashLocation = hashDirectory + "/" + packageName.Replace("/", "-");
					return hashLocation;
				}
			}

			return null;
		}
	}
}