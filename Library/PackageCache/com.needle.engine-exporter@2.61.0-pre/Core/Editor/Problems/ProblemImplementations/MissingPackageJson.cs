namespace Needle.Engine.Problems
{
	public class MissingPackageJson : PackageJsonProblem
	{
		public MissingPackageJson(string packageJsonPath, string field, string key, string value) : base(packageJsonPath, field, key, value,
			$"Missing package.json", new InstallProjectFix(){MissingPackageName = key})
		{
		}
	}
}