using System.Collections.Generic;
using System.IO;
using Needle.Engine.Utils;
using Unity.Profiling;

namespace Needle.Engine.Problems
{
	internal static class ProjectValidator
	{
		private static IList<IProblemFactory> _problemFactories;
		private static ProfilerMarker _projectValidatorMarker = new ProfilerMarker("Project Validator: Find Problems");
		private static readonly string[] packageJsonKeys = new[]
		{
			"scripts",
			"dependencies",
			"devDependencies"
		};

		public static bool FindProblems(string packageJsonPath, out List<IProblem> problems)
		{
			using var findProblemsMarker = _projectValidatorMarker.Auto();
			
			var list = default(List<IProblem>);
			
			_problemFactories ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IProblemFactory>();

			foreach (var fac in _problemFactories)
			{
				var enumerator = fac.CreateProjectProblems(packageJsonPath);
				foreach(var prob in enumerator)
				{
					AddProblem(prob, ref list);
				}
			}
			
			if (Validations.RunValidation(packageJsonPath))
			{
			}

			var modulesDir = Path.GetDirectoryName(packageJsonPath) + "/node_modules";
			if (!Directory.Exists(modulesDir))
			{
				// nothing to do, we need to run install
			}
			else
			{
				foreach (var key in packageJsonKeys)
				{
					if (PackageUtils.TryReadBlock(packageJsonPath, key, out var deps))
					{
						// TODO: check if threejs and needle-engine are in dependencies
						if (deps.Count > 0)
						{
							foreach (var fac in _problemFactories)
							{
								foreach (var dep in deps)
								{
									var problem = fac.CreatePackageProblem(packageJsonPath, key, dep.Key, dep.Value);
									if (problem != null)
									{
										AddProblem(problem, ref list);
									}
								}
							}
						}
					}
				}
			}

			void AddProblem(IProblem prob, ref List<IProblem> _list)
			{
				_list ??= new List<IProblem>();
				_list.Add(prob);
			}

			problems = list;
			return problems?.Count > 0;
		}
	}
}