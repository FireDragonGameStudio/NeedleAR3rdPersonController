using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Utils;

namespace Needle.Engine.Problems
{
	/// <summary>
	/// Runs a list of fixes that all must succeed
	/// </summary>
	public class CompoundFix : IProblemFix
	{
		private readonly IProblemFix[] fixes;

		public CompoundFix(params IProblemFix[] fixes)
		{
			this.fixes = fixes;
			this.Suggestion = string.Join("\n• ", fixes.Where(fix => !string.IsNullOrWhiteSpace(fix.Suggestion)).Select(f => f.Suggestion).Distinct());
		}


		public string Suggestion { get; }

		public Task<ProblemFixResult> Run(ProblemContext context)
		{
			return Task.WhenAll(fixes.Select(f => f.Run(context))).ContinueWith(t =>
			{
				var results = t.Result;
				var success = results.All(r => r.Success);
				var combinedMessage = string.Join("\n", results
					.Where(result => success == result.Success && !string.IsNullOrWhiteSpace(result.Message))
					.Select(result => result.Message)
				);
				return new ProblemFixResult(success, combinedMessage);
			});
		}

		public override string ToString()
		{
			var allTheFixes = string.Join(", ", fixes.Select(p => p.ToString()));
			return $"CompoundFix: {allTheFixes}";
		}
	}
}