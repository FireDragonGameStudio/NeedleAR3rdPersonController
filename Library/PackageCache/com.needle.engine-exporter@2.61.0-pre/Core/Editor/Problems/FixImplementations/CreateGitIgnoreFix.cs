using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Projects;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Problems
{
	public class CreateGitIgnoreFix : IProblemFix
	{
		private readonly string gitignoreFilePath;

		public CreateGitIgnoreFix(string gitignoreFilePath)
		{
			this.gitignoreFilePath = gitignoreFilePath;
			Suggestion = "Create .gitignore file at " + Path.GetDirectoryName(gitignoreFilePath);
		}

		public string Suggestion { get; }

		public async Task<ProblemFixResult> Run(ProblemContext context)
		{
			await Task.CompletedTask;
			if (File.Exists(gitignoreFilePath))
			{
				return new ProblemFixResult(true, "Fix not needed anymore: gitignore found at " + gitignoreFilePath);
			}
			
			// foreach (var temp in ProjectGenerator.Templates)
			// {
			// 	var templatePath = temp.GetPath() + "/.gitignore";
			// 	if (File.Exists(templatePath))
			// 	{
			// 		File.Copy(templatePath, gitignoreFilePath);
			// 		if (File.Exists(gitignoreFilePath))
			// 		{
			// 			var msg = "Copied gitignore from " + templatePath + " to " + gitignoreFilePath;
			// 			return new ProblemFixResult(true, msg);
			// 		}
			// 	}
			// }

			// var templateIgnorePath = AssetDatabase.GUIDToAssetPath("8a0f3f921f064605a4eb0f260ea47acf");
			// if (File.Exists(templateIgnorePath))
			// {
			// 	File.Copy(templateIgnorePath, gitignoreFilePath);
			// 	var msg = "Copied gitignore from " + templateIgnorePath + " to " + gitignoreFilePath;
			// 	return new ProblemFixResult(true, msg);
			// }


			File.WriteAllLines(gitignoreFilePath, new[]
			{
				"**/node_modules",
				"assets/",
				"src/generated/",
				"dist/",
				"include/draco/",
				"include/ktx2/",
				"include/three/",
				"include/console/",
				"include/three-mesh-ui-assets/",
				"include/fonts/",
			});
			return new ProblemFixResult(true, "Created gitignore at " + gitignoreFilePath);
		}
	}
}