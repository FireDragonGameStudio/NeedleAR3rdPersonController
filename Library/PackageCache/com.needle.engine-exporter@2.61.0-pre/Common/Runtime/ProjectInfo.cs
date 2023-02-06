using System;
using System.IO;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	public class ProjectInfo : IProjectInfo
	{
		public static string GetAssetsDirectory(string projectDirectory = null)
		{
			if (string.IsNullOrEmpty(projectDirectory))
			{
				var exp = Object.FindObjectOfType<ExportInfo>();
				if (!exp) return null;
				projectDirectory = exp.GetProjectDirectory();
			}

			projectDirectory = Path.GetFullPath(projectDirectory);

			if (NeedleProjectConfig.TryLoad(projectDirectory, out var config))
			{
				return projectDirectory + "/" + config.assetsDirectory;
			}

			return projectDirectory + "/assets";
		}

		public static string GetNeedleEngineRuntimePackageDirectory(string projectDirectory = null)
		{
			if (string.IsNullOrEmpty(projectDirectory))
			{
				return Path.GetFullPath("Packages/" + Constants.RuntimeUnityPackageName) + "/package~";
			}
			return projectDirectory + "/node_modules/" + Constants.RuntimeNpmPackageName;
		}

		public static string GetCurrentNeedleEngineVersion(string projectDirectory)
		{
			var dir = GetNeedleEngineRuntimePackageDirectory(projectDirectory);
			var packageJsonPath = dir + "/package.json";
			return GetVersionFromPackageJson(packageJsonPath);
		}

		public static string GetCurrentNeedleExporterChangelog(out string changelogPath)
		{
			changelogPath = Path.GetFullPath("Packages/" + Constants.UnityPackageName + "/Changelog.md");
			if (File.Exists(changelogPath)) return File.ReadAllText(changelogPath);
			return null;
		}

		public static string GetCurrentNeedleEngineChangelog(out string changelogPath)
		{
			changelogPath = Path.GetFullPath("Packages/" + Constants.RuntimeUnityPackageName + "/Changelog.md");
			if (File.Exists(changelogPath)) return File.ReadAllText(changelogPath);
			return null;
		}

		public static string GetCurrentNeedleEnginePackageVersion(out string path)
		{
			return GetCurrentPackageVersion(Constants.RuntimeUnityPackageName, out path);
		}

		public static string GetCurrentNeedleExporterPackageVersion(out string path)
		{
			return GetCurrentPackageVersion(Constants.UnityPackageName, out path);
		}

		public static string GetCurrentPackageVersion(string packageName, out string path)
		{
			path = "Packages/" + packageName + "/package.json";
			return GetVersionFromPackageJson(path);
		}

		private static string GetVersionFromPackageJson(string path)
		{
			if (!File.Exists(path)) return null;
			var content = File.ReadAllText(path);
			var match = Regex.Match(content, "\"version\"\\s*:\\s*\"(?<version>.+)\"", RegexOptions.Multiline);
			if (match.Success)
			{
				var version = match.Groups["version"]?.Value;
				return version;
			}
			return null;
		}


		public string ProjectDirectory { get; private set; }
		public string AssetsDirectory { get; private set; }
		public string ScriptsDirectory { get; private set; }
		public string GeneratedDirectory { get; private set; }
		public string PackageJsonPath { get; private set; }

		public bool Exists()
		{
			return File.Exists(PackageJsonPath);
		}

		public bool IsInstalled()
		{
			return Directory.Exists(ModuleDirectory);
		}

		public string ModuleDirectory { get; private set; }
		public string EnginePath { get; private set; }
		public string EngineDirectory { get; private set; }
		public string EngineComponentsDirectory { get; private set; }
		public string ExperimentalEngineComponentsDirectory { get; private set; }

		public ProjectInfo(string projectDirectory)
		{
			if (!string.IsNullOrWhiteSpace(projectDirectory))
				UpdateFrom(projectDirectory);
		}

		public void UpdateFrom(string projectDirectory)
		{
			ProjectDirectory = projectDirectory;
			PackageJsonPath = projectDirectory + "/package.json";
			AssetsDirectory = ProjectDirectory + "/assets";
			ScriptsDirectory = ProjectDirectory + "/src/scripts";
			GeneratedDirectory = ProjectDirectory + "/src/generated";

			ModuleDirectory = GetNeedleEngineRuntimePackageDirectory(ProjectDirectory);
			// if the package is installed from npm the src code is in a subdirectory
			if (Directory.Exists(ModuleDirectory + "/src")) ModuleDirectory += "/src";
			EngineDirectory = ModuleDirectory + "/engine";
			EnginePath = EngineDirectory + "/engine.js";
			EngineComponentsDirectory = ModuleDirectory + "/engine-components";
			ExperimentalEngineComponentsDirectory = ModuleDirectory + "/engine-components-experimental";

			TryUpdateFromNeedleProjectConfig();
		}

		public bool IsValid()
		{
			return !string.IsNullOrEmpty(ProjectDirectory) && Directory.Exists(ProjectDirectory);
		}

		public override string ToString()
		{
			return "ProjectDirectory: " + ProjectDirectory + ",\n" +
			       "AssetsDirectory: " + AssetsDirectory + ",\n" +
			       "ScriptsDirectory: " + ScriptsDirectory + ",\n" +
			       "GeneratedDirectory: " + GeneratedDirectory + ",\n" +
			       "ModuleDirectory: " + ModuleDirectory + ",\n" +
			       "EnginePath: " + EnginePath + ",\n" +
			       "EngineComponentsDir: " + EngineComponentsDirectory;
		}

		private bool TryUpdateFromNeedleProjectConfig(int iteration = 0)
		{
			try
			{
				var path = ProjectDirectory + "/" + NeedleProjectConfig.NAME;
				if (File.Exists(path))
				{
					var content = File.ReadAllText(path);
					var config = JsonConvert.DeserializeObject<NeedleProjectConfig>(content);
					if (config != null)
					{
						if (TryGetFullPath(config.assetsDirectory, out var dir))
							AssetsDirectory = dir;
						if (TryGetFullPath(config.scriptsDirectory, out dir))
							ScriptsDirectory = dir;
						// the generated directory will be created if it doesn't exist
						TryGetFullPath(config.codegenDirectory, out dir);
						GeneratedDirectory = dir;
					}
					return true;
				}
				if (iteration <= 0 && HasMissingDirectory())
				{
					// try to detect the current project structure and fill it into the new config
					if(NeedleProjectConfig.TryCreate(this, out _, out _))
						return TryUpdateFromNeedleProjectConfig(iteration + 1);
				}
			}
			catch (Exception err)
			{
				Debug.LogException(err);
			}

			bool TryGetFullPath(string partial, out string fullPath)
			{
				if (string.IsNullOrWhiteSpace(partial))
				{
					fullPath = null;
					return false;
				}
				fullPath = ProjectDirectory + "/" + partial;
				return true; // Directory.Exists(fullPath) || File.Exists(fullPath);
			}

			return false;
		}

		private bool HasMissingDirectory()
		{
			return !Directory.Exists(AssetsDirectory) ||
			       !Directory.Exists(ScriptsDirectory) ||
			       !Directory.Exists(GeneratedDirectory);
		}
	}
}