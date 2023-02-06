// #nullable enable
// using System.Threading.Tasks;
// using JetBrains.Annotations;
// using Needle.Engine.Problems;
//
// namespace Needle.Engine.ProjectBundle.Problems
// {
// 	public class MissingDependencies : PackageJsonProblem
// 	{
// 		public MissingDependencies(string packageJsonPath, string field, string key, string value, string message, IProblemFix? fix) : base(packageJsonPath, field, key, value, message, fix)
// 		{
// 			Severity = ProblemSeverity.Error;
// 			Fix = new MissingDependenciesFix(key + " is not installed");
// 		}
// 	}
// 	
// 	public class MissingDependenciesFix : InstallProjectFix
// 	{
// 		public MissingDependenciesFix(string? suggestion)
// 		{
// 			Suggestion = suggestion;
// 		}
//
// 		public string? Suggestion { get; }
// 	}
// }