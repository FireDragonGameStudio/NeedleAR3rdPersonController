using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class PackageUtils
	{
		public static bool IsMutable(string path)
		{
			path = Path.GetFullPath(path);
			var mutable = path.Contains("Library/PackageCache") == false && path.Contains("Library\\PackageCache") == false;
			return mutable;
		}
		
		private static string GetBlockPattern(string key) => "(\"" + key + "\" ?\\: ?)(?<dependencies>\\{.*?\\})";
		private static readonly Dictionary<string, Regex> _blockRegexCache = new Dictionary<string, Regex>();

		private static Regex GetBlockRegex(string key)
		{
			if (_blockRegexCache.ContainsKey(key)) return _blockRegexCache[key];
			var regex = new Regex(GetBlockPattern(key), RegexOptions.Singleline | RegexOptions.Compiled);
			_blockRegexCache.Add(key, regex);
			return regex;
		}

		private static readonly Regex versionRegex = new Regex("(\"version\" ?: ?)(?<version>\".+\")", RegexOptions.Multiline | RegexOptions.Compiled);

		public static bool SetVersion(string packageJsonPath, string version)
		{
			if (!File.Exists(packageJsonPath)) return false;
			var res = versionRegex.Replace(File.ReadAllText(packageJsonPath), "$1" + "\"" + version + "\"");
			File.WriteAllText(packageJsonPath, res);
			return true;
		}

		public static bool TryGetVersion(string packageJsonPath, out string version)
		{
			version = null;
			if (!File.Exists(packageJsonPath)) return false;
			var content = File.ReadAllText(packageJsonPath);
			var match = versionRegex.Match(content);
			if (match.Success)
			{
				version = match.Groups["version"].Value?.Trim('"');
				return !string.IsNullOrWhiteSpace(version);
			}
			return false;
		}

		public static string GetPackageName(string packageJsonPath)
		{
			var content = File.ReadAllText(packageJsonPath);
			var name = Regex.Match(content, "\"name\" ?: ?\"(?<name>.+)\"");
			if (name.Success) return name.Groups["name"].Value;
			return null;
		}

		public static bool TryGetMainFile(string packageJsonPath, out string mainFile)
		{
			var content = File.ReadAllText(packageJsonPath);
			var main = Regex.Match(content, "\"main\"\\: ?\"(?<main>.+)\"");
			if (main.Success)
			{
				mainFile = main.Groups["main"].Value;
				return true;
			}
			mainFile = null;
			return false;
		}

		private class PackageJsonScripts
		{
			public Dictionary<string, string> scripts;
		}
		public static bool TryGetScripts(string packageJsonPath, out Dictionary<string, string> scripts)
		{
			if (File.Exists(packageJsonPath))
			{
				var content = File.ReadAllText(packageJsonPath);
				var obj = JsonConvert.DeserializeObject<PackageJsonScripts>(content);
				scripts = obj?.scripts;
				return scripts != null;
			}
			scripts = null;
			return false;
		}

		public static bool IsDependency(string packageJsonPath, string packageName)
		{
			if (!string.IsNullOrEmpty(packageName) && TryReadDependencies(packageJsonPath, out var deps))
				return deps.ContainsKey(packageName);
			return false;
		}

		public static bool TryReadBlock(string packageJsonPath, string field, out Dictionary<string, string> dict)
		{
			dict = null;
			if (!File.Exists(packageJsonPath)) return false;
			var targetJson = File.ReadAllText(packageJsonPath);
			var dependenciesMatch = GetBlockRegex(field).Match(targetJson);

			if (dependenciesMatch.Success)
			{
				var match = dependenciesMatch.Groups["dependencies"];
				if (match != null && match.Success)
				{
					dict = JsonConvert.DeserializeObject<Dictionary<string, string>>(match.Value);
					return dict != null;
				}
			}
			return false;
		}

		public static bool TryWriteBlock(string packageJsonPath, string field, Dictionary<string, string> dict)
		{
			var content = File.ReadAllText(packageJsonPath);
			var res = JsonConvert.SerializeObject(dict, Formatting.Indented);
			const char indent = '\t';
			res = res.Replace("\n", "\n" + indent);

			// $1 is referring to the "dependencies" capture (first group, 0 is ALL)
			var final = Regex.Replace(content, GetBlockPattern(field), $"$1{res}", RegexOptions.Singleline);
			File.WriteAllText(packageJsonPath, final);
			return true;
		}
		
		public static bool TryReadDependencies(string packageJsonPath, out Dictionary<string, string> dependencies, string key = "dependencies")
		{
			return TryReadBlock(packageJsonPath, key, out dependencies);
		}

		public static bool TryWriteDependencies(string packageJsonPath, Dictionary<string, string> dependencies, string key = "dependencies")
		{
			return TryWriteBlock(packageJsonPath, key, dependencies);
		}

		public static bool AddPackage(string targetDir, string targetPackageDir)
		{
			var targetPath = targetDir + "/package.json";
			if (!File.Exists(targetPath)) return false;
			var packagePath = targetPackageDir + "/package.json";
			if (!File.Exists(packagePath)) return false;
			if (TryReadDependencies(targetPath, out var dependencies))
			{
				var name = GetPackageName(packagePath);
				var relPath = GetFilePath(targetDir, targetPackageDir);
				if (!dependencies.ContainsKey(name))
					dependencies.Add(name, relPath);
				else dependencies[name] = relPath;

				return TryWriteDependencies(targetPath, dependencies);
			}

			return false;
		}

		public static bool Remove(string packageJsonPathOrDirectory, string name, string key = "dependencies")
		{
			if(!packageJsonPathOrDirectory.EndsWith("package.json"))
				packageJsonPathOrDirectory += "/package.json";
			if (!File.Exists(packageJsonPathOrDirectory)) return false;
			if (TryReadDependencies(packageJsonPathOrDirectory, out var dict, key))
			{
				dict.Remove(name);
				return TryWriteDependencies(packageJsonPathOrDirectory, dict, key);
			}
			return false;
		}

		/// <summary>
		/// Get a project relative file path for package.json
		/// </summary>
		public static string GetFilePath(string targetDir, string sourceDir)
		{
			var packageJsonUri = new Uri(targetDir + "/");
			if (!Path.IsPathRooted(sourceDir)) sourceDir = Path.GetFullPath(sourceDir);
			var sourceUri = new Uri(sourceDir);
			return "file:" + packageJsonUri.MakeRelativeUri(sourceUri).ToString().Replace("%20", " ");
		}

		public static bool IsPath(string val)
		{
			return !val.StartsWith("git") && (val.StartsWith("file:") || (!val.StartsWith("@") && val.Contains("/")));
		}

		public static bool TryGetPath(string dir, string val, out string fullPath)
		{
			if (IsPath(val))
			{
				if (val.StartsWith("file:")) val = val.Substring("file:".Length);
				// if its already a full path
				if (Path.IsPathRooted(val))
				{
					fullPath = val;
					return true;
				}
				// otherwise we need to reconstruct the full path relative to the directory
				fullPath = Path.GetFullPath(dir + "/" + val);
				return true;
			}
			fullPath = null;
			return false;
		}

		private static readonly string valueRegexPattern = "\"<packageName>\"\\: ?\"(?<value>.*)\"";
		public static bool GetDependencyValue(string packageJsonPathOrContent, string packageName, out string value)
		{
			if (string.IsNullOrWhiteSpace(packageJsonPathOrContent))
			{
				value = null;
				return false;
			}
			
			if (File.Exists(packageJsonPathOrContent)) packageJsonPathOrContent = File.ReadAllText(packageJsonPathOrContent);

			var pattern = valueRegexPattern.Replace("<packageName>", Regex.Escape(packageName));
			var match = Regex.Match(packageJsonPathOrContent, pattern);
			if (match.Success)
			{
				value = match.Groups["value"].Value;
				return true;
			}
			
			value = null;
			return false;
		}

		public struct Options
		{
			public bool MakePathRelativeToPackageJson;
		}

		public static bool ReplaceDevDependency(string packageJsonPath, string name, string versionOrPath, Options options = default)
		{
			return Replace("devDependencies", packageJsonPath, name, versionOrPath, options);
		}

		public static bool ReplaceDependency(string packageJsonPath, string name, string versionOrPath, Options options = default)
		{
			return Replace("dependencies", packageJsonPath, name, versionOrPath, options);
		}

		private static bool Replace(string blockName, string packageJsonPath, string name, string versionOrPath, Options options = default)
		{
			if (options.MakePathRelativeToPackageJson)
			{
				if (Directory.Exists(versionOrPath))
				{
					versionOrPath = new Uri(packageJsonPath).MakeRelativeUri(new Uri(Path.GetFullPath(versionOrPath))).ToString();
				}
			}

			var pattern = "(" + blockName + ".+?\"" + Regex.Escape(name) + "\" ?: ?\")(?<version>.+?)(\")";
			var content = File.ReadAllText(packageJsonPath);
			versionOrPath = versionOrPath.Replace("\\", "/");
			content = Regex.Replace(content, pattern, "$1" + versionOrPath + "$2", RegexOptions.Singleline);
			File.WriteAllText(packageJsonPath, content);
			return true;
		}
	}
}