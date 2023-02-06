using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Problems
{
	/// <summary>
	/// This fix is intended to upgrade "old" code that still uses the previous package name
	/// </summary>
	public class ReplaceOldImportsInCodeFilesFix : IProblemFix
	{
		private static Regex GetImportReplaceRegex(string toReplace)
		{
			return new Regex("(import.+)(?<replace>" + Regex.Escape(toReplace) + ")(.*)", RegexOptions.Compiled);
		}


		public string Suggestion { get; } = null;

		private readonly string packageJsonPath;
		private readonly string importNameToReplace;
		private readonly string replacement;

		public ReplaceOldImportsInCodeFilesFix(string packageJsonPath, string importNameToReplace, string replacement)
		{
			this.packageJsonPath = packageJsonPath;
			this.importNameToReplace = importNameToReplace;
			this.replacement = replacement;//Regex.Escape();
		}

		public Task<ProblemFixResult> Run(ProblemContext context)
		{
			if (!EditorUtility.DisplayDialog("Fix imports", "Automatically fix imports of \"" + importNameToReplace + "\" to \"" + replacement + "\" in scripts found in " + packageJsonPath, "Run codefix", "No don't change my code"))
			{
				return Task.FromResult(new ProblemFixResult(false, "Cancelled by user"));
			}
			
			if (string.IsNullOrEmpty(packageJsonPath))
			{
				return Task.FromResult(new ProblemFixResult(false, "Did not provide package json path"));
			}
			var fixedFiles = 0;
			var directoryName = Path.GetDirectoryName(packageJsonPath);
			var dir = new DirectoryInfo(directoryName!);
			var regex = GetImportReplaceRegex(importNameToReplace);
			var replace = Regex.Escape(this.replacement);
			foreach (var file in EnumerateScriptFilesRecursive(dir))
			{
				var content = File.ReadAllText(file.FullName);
				var newText = regex.Replace(content, "$1" + replace + "$2"); // content.Replace(importNameToReplace, replacement);
				File.WriteAllText(file.FullName, newText);
				fixedFiles += 1;
			}

			var index = dir + "/index.html";
			if (File.Exists(index))
			{
				var file = File.ReadAllText(index);
				file = file.Replace("needle-tiny", "needle-engine");
				File.WriteAllText(index, file);
			}
			var cssPath = dir + "/src/styles/style.css";
			if (File.Exists(cssPath))
			{
				var file = File.ReadAllText(cssPath);
				file = file.Replace("needle-tiny", "needle-engine");
				File.WriteAllText(cssPath, file);
			}
			
			return Task.FromResult(new ProblemFixResult(true, "Replaced " + importNameToReplace + " in " + fixedFiles + " files"));
		}

		private static IEnumerable<FileInfo> EnumerateScriptFilesRecursive(DirectoryInfo dir)
		{
			if (!dir.Exists) yield break;

			foreach (var file in dir.EnumerateFiles())
			{
				if (file.Name.EndsWith(".ts"))
				{
					yield return file;
				}
			}
			foreach (var sub in dir.EnumerateDirectories())
			{
				switch (sub.Name)
				{
					case ".git":
					case "node_modules":
						continue;
				}

				foreach (var file in EnumerateScriptFilesRecursive(sub))
				{
					yield return file;
				}
			}
		}
	}
}