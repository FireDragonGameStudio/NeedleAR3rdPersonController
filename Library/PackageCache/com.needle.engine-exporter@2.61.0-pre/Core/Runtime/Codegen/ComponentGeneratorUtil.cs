using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Needle.Engine.Utils;
using Object = UnityEngine.Object;

namespace Needle.Engine.Codegen
{
	public static class ComponentGeneratorUtil
	{
		public static string GetGuid(string str)
		{
			return GuidGenerator.GetGuid(str);
		}

		public static string GenerateAndSetStableGuid(string filePath, string seed)
		{
			if (!filePath.EndsWith(".meta"))
			{
				// if the script was just created and no guid exists yet
				filePath += ".meta";
			}
			
			if (string.IsNullOrEmpty(filePath) || !filePath.EndsWith(".meta")) return null;
			
			if (!File.Exists(filePath))
			{
				const string guidTemplate = @"fileFormatVersion: 2
guid: <guid>";
				var newGuid = GetGuid(Path.GetFileNameWithoutExtension(filePath) + seed);
				File.WriteAllText(filePath, guidTemplate.Replace("<guid>", newGuid));
				return newGuid;
			}
			
			var content = File.ReadAllText(filePath);
			var guid = GetGuid(Path.GetFileNameWithoutExtension(filePath) + seed);
			content = Regex.Replace(content, "(^guid:\\s?)([a-zA-Z0-9]{32})", $"$1{guid}", RegexOptions.Multiline | RegexOptions.ECMAScript);
			File.WriteAllText(filePath, content);
			return guid;
		}

		internal static void EnsureAssemblyDefinition(string filePath)
		{
			// TODO: we should generate a asmdef here in this directory if none exists yet
		}
		
		internal static void FilterDirectoriesToWatch(List<ComponentGenerationInfo> directories)
		{
			var proj = Object.FindObjectOfType<ExportInfo>();
			if (proj && proj.Exists())
			{
				var projectDir = new DirectoryInfo(proj.GetProjectDirectory());
				var packageJson = projectDir.FullName + "/package.json";
				if (PackageUtils.TryReadDependencies(packageJson, out var dict))
				{
					for (var index = directories.Count - 1; index >= 0; index--)
					{
						var path = directories[index];
						var dir = new DirectoryInfo(path.SourceDirectory);

						if (dir.FullName.StartsWith(projectDir.FullName)) continue;
						var found = false;
						foreach (var dep in dict)
						{
							if (!dep.Value.StartsWith("file:")) continue;
							if (!Directory.Exists(dep.Value)) continue;
							var depDir = new DirectoryInfo(Path.GetFullPath(dep.Value));
							if (!dir.FullName.StartsWith(depDir.FullName)) continue;
							found = true;
							break;
						}
						if (!found)
						{
							directories.RemoveAt(index);
						}
					}
				}
			}
		}
	}
}