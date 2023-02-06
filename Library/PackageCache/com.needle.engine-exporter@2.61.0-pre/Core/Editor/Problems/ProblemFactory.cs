#nullable enable

using System.Collections.Generic;

namespace Needle.Engine.Problems
{
	public interface IProblemFactory
	{
		public IEnumerable<IProblem> CreateProjectProblems(string packageJsonPath);
		public IProblem? CreatePackageProblem(string packageJsonPath, string packageJsonKey, string key, string value);
	}
}