#nullable enable
using System.Threading.Tasks;

namespace Needle.Engine.Problems
{
	public interface IProblem
	{
		string Id { get; }
		string Message { get; }
		ProblemSeverity Severity { get; }
		IProblemFix? Fix { get; }
	}

	public interface IProblemFix
	{
		string? Suggestion { get; }
		Task<ProblemFixResult>? Run(ProblemContext context);
	}

	public readonly struct ProblemFixResult
	{
		public readonly bool Success;
		public readonly string? Message;

		public ProblemFixResult(bool success, string? message)
		{
			Success = success;
			Message = message ?? "Unknown error";
		}

		public static ProblemFixResult GetResult(bool success, string? messageOnSuccess, string? messageOnFailure)
		{
			return new ProblemFixResult(success, success ? messageOnSuccess : messageOnFailure);
		}
	}

	public abstract class Problem : IProblem
	{
		public string Id { get; protected set; }
		public string Message { get; protected set; }
		public ProblemSeverity Severity { get; protected set; } = ProblemSeverity.Warning;
		public IProblemFix? Fix { get; protected set; }

		protected Problem(string message, string id, IProblemFix? fix)
		{
			Id = id;
			this.Message = message;
			this.Severity = Severity;
			Fix = fix;
		}
	}

	public abstract class PackageJsonProblem : Problem
	{
		public string PackageJsonPath { get; protected set; }
		public string FieldName { get; protected set; }
		public string Key { get; protected set; }
		public string Value { get; protected set; }

		protected PackageJsonProblem(string packageJsonPath, string packageJsonKey, string key, string value, string message, IProblemFix? fix) : base(message, key, fix)
		{
			this.PackageJsonPath = packageJsonPath;
			this.FieldName = packageJsonKey;
			this.Key = key;
			this.Value = value;
		}

	}
}