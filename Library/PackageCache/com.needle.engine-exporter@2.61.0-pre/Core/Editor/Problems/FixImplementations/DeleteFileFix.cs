using System.IO;
using System.Threading.Tasks;

namespace Needle.Engine.Problems
{
	public class DeleteFileFix : IProblemFix
	{
		private readonly string filePath;
		
		public DeleteFileFix(string filePath)
		{
			this.filePath = filePath;
		}

		public string Suggestion => "Delete " + filePath;
		
		public Task<ProblemFixResult> Run(ProblemContext context)
		{
			if (File.Exists(filePath)) File.Delete(filePath);
			return Task.FromResult(new ProblemFixResult(true, "Deleted " + filePath));
		}
	}
}