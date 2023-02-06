using System;
using System.IO;
using Needle.Engine.Utils;
using Semver;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Problems
{
	public class Validations
	{
		
		[InitializeOnLoadMethod]
		private static void Init()
		{
			var obj = Object.FindObjectOfType<ExportInfo>();
			if (obj && obj.Exists())
				RunValidation(obj.GetProjectDirectory() + "/package.json", false);
		}
		
		[MenuItem(Constants.MenuItemRoot + "/Internal/Try Validate Project")]
		private static void RunValidation()
		{
			var obj = Object.FindObjectOfType<ExportInfo>();
			if (!obj)
			{
				Debug.LogWarning("No " + nameof(ExportInfo) + " component found");
				return;
			}
			if (obj.Exists())
			{
				Debug.Log("Run Validation");
				if (!RunValidation(obj.GetProjectDirectory() + "/package.json", true, false))
					Debug.LogError("Validation failed");
				else Debug.Log("Validation finished");
			}
			else Debug.LogWarning("Project directory doest not exit: " + obj.GetProjectDirectory(), obj);
		}

		private static string lastTestDirectory = null;

		public static bool RunValidation(string packageJsonPath, bool force = false, bool silent = true)
		{
			if (!File.Exists(packageJsonPath)) return false;
			if (!force && lastTestDirectory == packageJsonPath) return true;
			if (Actions.IsInstalling())
			{
				if(!silent) Debug.LogWarning("Project is currently installing. Please wait for installation to finish before running validation.");
				return true;
			}
			lastTestDirectory = packageJsonPath;
			ValidateMainTsImport(packageJsonPath);
			ValidateThreeInstallation(packageJsonPath, force, silent);
			return true;
		}

		private static void ValidateMainTsImport(string packageJsonPath)
		{
			var mainTsPath = Path.GetDirectoryName(packageJsonPath) + "/src/main.ts";
			if (File.Exists(mainTsPath))
			{
				var content = File.ReadAllText(mainTsPath);
				if (content.IndexOf("@needle-tools/engine/index", StringComparison.Ordinal) >= 0)
				{
					Debug.Log("Update main.ts @needle-tools/engine import");
					content = content.Replace("@needle-tools/engine/index", "@needle-tools/engine");
					File.WriteAllText(mainTsPath, content);
				}
			}
		}
		
		// TODO: this does not check locally installed threejs version
		private static void ValidateThreeInstallation(string packageJsonPath, bool force, bool silent)
		{
			// when installed threejs via github we sometimes might need 
			// to run npm update with the package name to ensure npm pulls latest changes
			// e.g. when we rebase our threejs fork and change the current branch
			// the following code checks if the threejs version that is currently installed
			// is the one we expect from the branch (e.g. by checking if some files are present)

			// maybe could also be done via https://docs.npmjs.com/cli/v8/commands/npm-diff
			var dir = Path.GetDirectoryName(packageJsonPath);
			var packageDir = $"{dir}/node_modules/{Constants.RuntimeNpmPackageName}";
			var threePath = $"{packageDir}/node_modules/three";
			if (Directory.Exists(threePath))
			{
				var groundProjectionPath = threePath + "/examples/jsm/objects/GroundProjectedEnv.js";
				if (!File.Exists(groundProjectionPath))
				{
					RunUpdateOnce();
					return;
				}
				var threePackageJson = threePath + "/package.json";
				if (File.Exists(threePackageJson) && PackageUtils.TryGetVersion(threePackageJson, out var currentVerStr))
				{
					if (SemVersion.TryParse(currentVerStr, SemVersionStyles.Any, out var currentVer) && SemVersion.TryParse("0.145.0", SemVersionStyles.Any, out var expectedSemVer))
					{
						if (currentVer < expectedSemVer)
						{
							Debug.Log("Detected old threejs version: " + currentVer + ", expected: " + expectedSemVer + "\n" + threePackageJson.AsLink());
							RunUpdateOnce();
							return;
						}
					}
				}
				
				if (!silent) Debug.Log("Correct threejs version detected at " + threePath);
			}
			else
			{
				if (!silent)
				{
					Debug.LogWarning("Can not validate: threejs directory is not found at " + threePath + ", try installing your project first");
				}
			}
			

			async void RunUpdateOnce()
			{
				var id = $"npmupdate/{packageDir}/three";
				if (!force)
				{
					// only run this automatic update once per session
					if (SessionState.GetBool(id, false)) 
						return;
				}
				force = false;
				SessionState.SetBool(id, true);
				packageDir = Path.GetFullPath(packageDir);
				var cmd = "npm update three " + NpmUtils.NpmNoProgressAuditFundArgs;
				Debug.Log(
					"Run npm update three in the background because your installed threejs version seems out of date - this might take a while\ncmd \"" +
					cmd + "\" in " + packageDir.AsLink());
				var res = await ProcessHelper.RunCommand(cmd, packageDir);
				if (res)
				{
					Debug.Log("Npm update for three completed successfully.");
					// after updating try to delete the installed three package and re-install
					try
					{
						await FileUtils.DeleteDirectoryRecursive(Path.GetFullPath(threePath));
					}
					catch (Exception)
					{
						// ignored
					}
					await Actions.RunNpmInstallAtPath(packageDir, false);
				}
				else
					Debug.Log("Npm update for three finished");
			}
		}
	}
}