namespace Needle.Engine.Problems
{
	/// <summary>
	/// If a dependency is not found in node_modules
	/// </summary>
	public class PackageNotInstalled : PackageJsonProblem
	{
		public PackageNotInstalled(string packageJsonPath, string field, string key, string value) : base(packageJsonPath, field, key, value,
			$"Package is not installed", new InstallProjectFix())
		{
		}
	}
}