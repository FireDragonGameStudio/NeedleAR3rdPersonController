using System.IO;
using System.Threading.Tasks;

namespace Needle.Engine.Problems
{
	public class ReplaceOldPackageNameInFileFix : IProblemFix
	{
		private readonly string filePath;
		private readonly string stringToReplace;
		
		public ReplaceOldPackageNameInFileFix(string filePath, string toReplace)
		{
			this.filePath = filePath;
			stringToReplace = toReplace;
		}

		public string Suggestion => "Replace old package name in project";

		public Task<ProblemFixResult> Run(ProblemContext context)
		{
			if (File.Exists(filePath))
			{
				var content = File.ReadAllText(filePath);
				content = content.Replace(stringToReplace, Constants.RuntimeNpmPackageName);
				File.WriteAllText(filePath, content);
				
				return Task.FromResult(new ProblemFixResult(true, $"Replace {stringToReplace} in " + filePath)); 
			}
			
			// its ok if the file doesnt exist we dont have to replace anything
			return Task.FromResult(new ProblemFixResult(true, $"Nothing to replace because file does not exist: {filePath}"));
		}
	}
}