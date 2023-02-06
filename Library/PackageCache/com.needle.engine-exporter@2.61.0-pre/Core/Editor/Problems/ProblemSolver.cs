using System.Collections.Generic;
using System.Threading.Tasks;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Problems
{
	public static class ProblemSolver
	{
		public static async void TryFixProblemsButIDontCareIfItWorks(string projectDirectory, List<IProblem> problems)
		{
			await TryFixProblems(projectDirectory, problems);
		}
		
		public static async Task<bool> TryFixProblems(string projectDirectory, List<IProblem> problems)
		{
			if (problems.Count <= 0) return true;

			if (!ExporterProjectSettings.instance.allowRunningProjectFixes)
			{
				Debug.LogWarning("Project has problems but automatic fixes are disabled in settings. The project might not start correctly. Please fix the following problems: " + problems.Print());
				return true;
			}

			var solved = true;
			var runningFixes = new List<string>();
			var tasks = new List<Task<ProblemFixResult>>();
			var context = new ProblemContext(projectDirectory);

			for (var index = problems.Count - 1; index >= 0; index--)
			{
				var p = problems[index];
				if (p.Fix != null)
				{
					var t = p.Fix.Run(context);
					if (t != null)
					{
						var fixName = ObjectNames.NicifyVariableName(p.Fix.GetType().Name);
						Debug.LogWarning("<b>Run fix</b>: " + fixName);
						runningFixes.Add(fixName);
						tasks.Add(t);
					}
				}
			}

			if (tasks.Count > 0)
			{
				var results = await Task.WhenAll(tasks);
				for (var i = results.Length - 1; i >= 0; i--)
				{
					var res = results[i];
					if (!res.Success)
					{
						LogHelpers.ErrorWithoutStacktrace($"Fix {runningFixes[i]} <b>{"failed".AsError()}</b>: {res.Message}");
						solved = false;
					}
					else
					{
						LogHelpers.LogWithoutStacktrace($"Fix {runningFixes[i]} {"<b>succeeded</b>".AsSuccess()}; {res.Message}");
						problems.RemoveAt(i);
					}
				}
			}

			return solved;
		}
	}
}