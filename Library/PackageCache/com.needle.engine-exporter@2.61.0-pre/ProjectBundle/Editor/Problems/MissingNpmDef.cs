using Needle.Engine.Problems;

namespace Needle.Engine
{
	public class MissingNpmDef : PackageJsonProblem
	{
		public MissingNpmDef(string packageJsonPath, string field, string key, string value)
			: base(packageJsonPath, field, key, value, $"Could not find npmdef", null)
		{
			Severity = ProblemSeverity.Error;
			Fix = new MissingNpmDefFix(this);
		}
	}
}