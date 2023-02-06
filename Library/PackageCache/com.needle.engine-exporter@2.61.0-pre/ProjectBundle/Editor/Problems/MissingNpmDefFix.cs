using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Problems;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public class MissingNpmDefFix : InstallProjectFix
	{
		private readonly PackageJsonProblem problem; // name, value, packageJsonPath;

		public MissingNpmDefFix(PackageJsonProblem problem)
		{
			this.problem = problem;
			this.MissingPackageName = problem.Key;
		}

		public override async Task<ProblemFixResult> Run(ProblemContext context)
		{
			var fixedPath = false;
			var message = default(string);
			if (context.SerializedDependencies != null)
			{
				// try fix missing npmdef path due to it being removed
				for (var i = 0; i < context.SerializedDependencies.Count; i++)
				{
					if (fixedPath) break;
					var dep = context.SerializedDependencies[i];
					var isMissingDependency = problem.Key == dep.Name;
					// this is the dependency that was serialized in unity but is now missing
					if (isMissingDependency)
					{
						// if we have a guid we can find the new npmdef project path and fix it in the package.json
						if (!string.IsNullOrEmpty(dep.Guid))
						{
							var newNpmDefPath = AssetDatabase.GUIDToAssetPath(dep.Guid);
							var newPath = Path.GetFullPath(newNpmDefPath);
							if (!string.IsNullOrEmpty(newPath) && newPath.EndsWith(".npmdef"))
							{
								// get package directory
								newPath = newPath.Substring(0, newPath.Length - ".npmdef".Length) + "~";
							}
							if (string.IsNullOrEmpty(newPath)) continue;
							message = "Updated path for \"" + problem.Key + "\" to \"" + newPath + "\"\nPrevious path: " + problem.Value;
							var res = dep.Install(problem.PackageJsonPath);
							if (res)
							{
								fixedPath = true;
								context.SerializedDependencies[i] = dep;
								// finally we need to reinstall the project once
								// otherwise we would see the not installed problem now
								var dir = Path.GetDirectoryName(problem.PackageJsonPath);
								if (dir != null)
								{
									var installationTask = base.Run(context);
									var installationResult = new ProblemFixResult(true, message);
									if (installationTask != null) installationResult = await installationTask;
									return ProblemFixResult.GetResult(installationResult.Success, message, installationResult.Message);
								}
								else
								{
									message = "Could not find package.json directory: " + problem.PackageJsonPath;
								}
							}
							else message = "Installation failed at " + problem.PackageJsonPath;
						}
						else
						{
							message = "Missing dependency guid for npmdef — " + dep.Name + " : " + dep.VersionOrPath;
						}
					}
				}

				if (EditorUtility.DisplayDialog("Missing Dependency",
					    "Your package.json contains a dependency to " + problem.Key +
					    " that could not be found automatically. Would you like to remove the dependency?\n\"" + problem.Key + "\":\"" + problem.Value + "\"", "Yes, remove it", "No, do nothing", DialogOptOutDecisionType.ForThisSession, "Needle_MissingDependency_CouldNotBeFound_" + problem.Key + "_" + problem.PackageJsonPath))
				{
					if (PackageUtils.Remove(problem.PackageJsonPath, problem.Key, problem.FieldName))
					{
						return new ProblemFixResult(true, "Removed dependency " + problem.Key + " from " + problem.PackageJsonPath);
					}
				}
				
				message ??=
					$"Could not find .npmdef for a dependency named {problem.Key}. The reason might be that the name was changed and \"{problem.Key}\" has now a different name? Please check the {"<b>package.json</b>".AsLink(problem.PackageJsonPath)}: you need to manually fix the path or remove the dependency.";
			}

			return ProblemFixResult.GetResult(false, null, message);
		}
	}
}