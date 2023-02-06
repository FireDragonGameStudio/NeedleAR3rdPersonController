using System;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Problems
{
	public class InstallProjectFix : IProblemFix
	{
		public string Suggestion => "Run install";

		public string MissingPackageName;
		
		public virtual Task<ProblemFixResult> Run(ProblemContext context)
		{
			var projectDirectory = context.ProjectDirectory;
			var directories = context.RunningFixes;
			
			if (directories.TryGetValue(projectDirectory, out var task)) return task;
			var t = InternalRun(projectDirectory);
			directories.Add(projectDirectory, t);
			return t;
		}

		private async Task<ProblemFixResult> InternalRun(string projectDirectory)
		{
			if (!string.IsNullOrEmpty(MissingPackageName))
			{
				var packagePathInModules = projectDirectory + "/node_modules/" + MissingPackageName;
				if (Directory.Exists(packagePathInModules))
				{
					try
					{
						// sometimes the directory actually still? existed but was empty
						// which led to npm not installing the package again and this fix not working
						// making sure the missing package directory is deleted should fix this
						Debug.Log("Delete " + packagePathInModules);
						// Directory.Delete(packagePathInModules, true);
						await FileUtils.DeleteDirectoryRecursive(packagePathInModules);
					}
					catch (Exception ex)
					{
						Debug.LogWarning("Failed to delete directory: " + packagePathInModules + "\nbut will continue trying to install " + projectDirectory + " - If the problem persists please delete the directory \"" + packagePathInModules + "\" manually.\n \n" + ex);
					}
				}
			}
			var installation = await Actions.RunNpmInstallAtPath(projectDirectory, false);
			return ProblemFixResult.GetResult(installation, $"Did run \"npm install\" without errors in {projectDirectory}".LowContrast(), "Failed running \"npm install\" in " + projectDirectory);
		}
	}
}