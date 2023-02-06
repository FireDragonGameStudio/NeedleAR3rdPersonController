using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Problems
{
	public class NpmUpdate : IProblemFix
	{
		private readonly string directory;
		
		public string Suggestion { get; } = "Run npm update";

		public List<string> packageNames = new List<string>();
		
		public NpmUpdate(string directory, string packageName = null)
		{
			this.directory = Path.GetFullPath(directory);
			if(!string.IsNullOrWhiteSpace(packageName)) 
				packageNames.Add(packageName);
		}
		
		public async Task<ProblemFixResult> Run(ProblemContext context)
		{
			if (Directory.Exists(directory))
			{
				var cmd = "npm update " + string.Join(" ", packageNames);
				Debug.Log("Run \"" + cmd + "\" in " + directory);
				await ProcessHelper.RunCommand(cmd, directory); 
			}

			return new ProblemFixResult(true, "Ran npm update");
		}
	}
}