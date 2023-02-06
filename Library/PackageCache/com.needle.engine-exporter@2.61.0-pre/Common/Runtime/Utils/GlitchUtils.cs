using System.Text.RegularExpressions;

namespace Needle.Engine.Utils
{
	public static class GlitchUtils
	{
		private static readonly Regex glitchProjectNameRegex = new Regex(@"(.*\/~?)?(?<projectname>[\w\-]+)\??.*", RegexOptions.Compiled);
		
		public static bool TryGetProjectName(string input, out string projectName)
		{
			if (string.IsNullOrWhiteSpace(input) || !input.Contains("glitch."))
			{
				projectName = null;
				return false;
			}
			// https://regex101.com/r/Wz9hzy/1
			var match = glitchProjectNameRegex.Match(input);// Regex.Match(input, @"(.*\/~?)?(?<projectname>[\w\-]+)\??.*");
			if (match.Success)
			{
				projectName = match.Groups["projectname"].Value;
				return !string.IsNullOrEmpty(projectName);
			}
			projectName = null;
			return false;
		}
	}
}