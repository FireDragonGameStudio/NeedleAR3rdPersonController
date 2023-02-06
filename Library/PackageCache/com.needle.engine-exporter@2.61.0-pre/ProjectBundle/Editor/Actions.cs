using System;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	internal static class Actions
	{
		internal static void SetDevDependenciesToLocal(string directory)
		{
			if (Directory.Exists(directory))
			{
				var packageJson = directory + "/package.json";
				if (File.Exists(packageJson))
				{
					var settings = ExporterProjectSettings.instance;
					var opts = new PackageUtils.Options() { MakePathRelativeToPackageJson = true };
					// var lastWriteTimeUtc = File.GetLastWriteTimeUtc(packageJson);
					// var lastAccessTimeUtc = File.GetLastAccessTimeUtc(packageJson);
					if (Directory.Exists(settings.localRuntimePackage))
					{ 
						PackageUtils.ReplaceDevDependency(packageJson, Engine.Constants.RuntimeNpmPackageName, Path.GetFullPath(settings.localRuntimePackage), opts);
					}
					if (Directory.Exists(settings.localThreejsPackage))
					{
						PackageUtils.ReplaceDevDependency(packageJson, "three", Path.GetFullPath(settings.localThreejsPackage), opts);
					}
					// File.SetLastWriteTimeUtc(packageJson, lastWriteTimeUtc);
					// File.SetLastAccessTimeUtc(packageJson, lastAccessTimeUtc);
				}
			}
		}

		internal static async void InstallBundle(Bundle bundle)
		{
			await InstallBundleTask(bundle);
		}

		internal static Task<bool> InstallBundleTask(Bundle bundle)
		{
			var projectDir = Path.GetFullPath(bundle.PackageDirectory);
			return InstallBundleTask(projectDir);
		}

		internal static Task<bool> InstallBundleTask(string dir)
		{
			var dirInfo = new DirectoryInfo(dir);
			if(!dirInfo.Exists)
				return Task.FromResult(false);
			Debug.Log($"<b>Install npmdef {dirInfo.Name}</b>");
			SetDevDependenciesToLocal(dir);
			return ProcessHelper.RunCommand($"{NpmCommands.SetDefaultNpmRegistry} && " + NpmUtils.GetInstallCommand(), dir);
		}

		internal static bool OpenWorkspace(string path, bool findInParent = false)
		{
			string dir = path;
			if (dir.EndsWith(".npmdef"))
				dir = Path.GetDirectoryName(path) + "/" + Path.GetFileNameWithoutExtension(path) + "~";

			if (File.Exists(dir)) dir = Path.GetDirectoryName(dir);

			if (string.IsNullOrEmpty(dir)) return false;

			dir = Path.GetFullPath(dir);
			
			if (Directory.Exists(dir))
			{
				InstallBundleTask(dir);

				var currentDir = new DirectoryInfo(dir);
				while (currentDir != null)
				{
					var workspace = Directory.EnumerateFiles(currentDir.FullName, "*.code-workspace");
					foreach (var ws in workspace)
					{
						EditorUtility.OpenWithDefaultApp(Path.GetFullPath(ws));
						return true;
					}
					if (!findInParent) break;
					currentDir = currentDir.Parent;
				}
			}
			return false;
		}

		private static Task<bool> DeleteDirectory(string dir, string name)
		{
			if (!Directory.Exists(dir))
			{
				Debug.LogError("Directory does not exist: " + dir);
				return Task.FromResult(false);
			}
#if UNITY_EDITOR_WIN
			// /Q is quiet mode, /s is subdirectories/files
			return ProcessHelper.RunCommand("rmdir /s /Q \"" + name + "\"", Path.GetFullPath(dir));
#else
			return ProcessHelper.RunCommand("rm -rf " + name, dir);
#endif
		}

		internal static async void DeleteRecursive(string targetDir)
		{
			var dirInfo = new DirectoryInfo(targetDir);
			await DeleteDirectory(dirInfo.Parent?.FullName, dirInfo.Name);
		}
	}
}