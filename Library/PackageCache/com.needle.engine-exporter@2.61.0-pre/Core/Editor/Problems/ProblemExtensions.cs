using System.Collections.Generic;
using System.Text;

namespace Needle.Engine.Problems
{
	internal static class ProblemExtensions
	{
		private static readonly List<string> printedSuggestions = new List<string>();
		
		public static string Print(this IList<IProblem> problems)
		{
			if (problems == null || problems.Count <= 0) return "None";
			var str = new StringBuilder();
			for (var index = 0; index < problems.Count; index++)
			{
				var p = problems[index];
				if (index > 0) str.Append(" • ");
				str.Append(p.Message);
			}
			
			var hasFix = false;
			printedSuggestions.Clear();
			foreach (var prob in problems)
			{
				if (prob?.Fix?.Suggestion != null)
				{
					var sug = prob.Fix.Suggestion;
					if (printedSuggestions.Contains(sug) || string.IsNullOrWhiteSpace(sug)) continue;
					if (!hasFix)
					{
						str.Append("\nHow to fix: ");
					}
					else str.Append(" or ");
					hasFix = true;
					printedSuggestions.Add(sug);
					str.Append(sug);
				}
			}
			return str.ToString();
		}
	}
}