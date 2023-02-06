using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.ProjectBundle
{
	// can not be a scriptable object because this should not require a dependency to or core package
	public class Bundle
	{
		[JsonIgnore] public string Path => System.IO.Path.GetFileNameWithoutExtension(FilePath) + "~";

		public bool IsMutable()
		{
			var fp = System.IO.Path.GetFullPath(FilePath);
			return !fp.Contains("Library\\PackageCache");
		}

		public bool IsValid()
		{
			return !string.IsNullOrEmpty(Path) && File.Exists(PackageFilePath);
		}

		// TODO: cache this to avoid file reads
		[JsonIgnore]
		public string PackageDirectory
		{
			get
			{
				var path = Path;
				if (path.EndsWith("package.json"))
					path = System.IO.Path.GetDirectoryName(path);
				var dir = System.IO.Path.GetDirectoryName(FilePath);
				return System.IO.Path.GetFullPath(dir + "/" + path);
			}
		}

		/// <summary>
		/// Path to package json
		/// </summary>
		[JsonIgnore]
		public string PackageFilePath => PackageDirectory + "/package.json";

		[JsonIgnore]
		internal string FilePath
		{
			get => _filePath;
			set
			{
				if (string.Equals(value, this._filePath, StringComparison.Ordinal)) return;
				this._filePath = value;
				codeGenDirectory = null;
			}
		}

		[JsonIgnore, NonSerialized] private string _filePath;

		public string FindPackageName()
		{
			var path = PackageDirectory + "/package.json";
			if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
			var name = PackageUtils.GetPackageName(path);
			return name;
		}

		private DirectoryInfo codeGenDirectory = null;

		public string FindScriptGenDirectory()
		{
			if (codeGenDirectory == null)
			{
				var dir = new FileInfo(FilePath);
				codeGenDirectory = new DirectoryInfo(dir.DirectoryName + "/" + System.IO.Path.GetFileNameWithoutExtension(FilePath) + ".codegen");
			}
			return codeGenDirectory.FullName;
		}

		public bool IsInstalled(string packageJsonPath)
		{
			if (packageJsonPath != null && File.Exists(packageJsonPath))
				return PackageUtils.IsDependency(packageJsonPath, FindPackageName());
			return false;
		}

		public void Install(ExportInfo exportInfo = null)
		{
			var exp = exportInfo ? exportInfo : Object.FindObjectOfType<ExportInfo>();
			if (!exp) return;
			var path = PackageDirectory;
			if (PackageUtils.AddPackage(exp.GetProjectDirectory(), path))
			{
				Debug.Log("<b>Added package</b> " + FilePath + " to " + exp.PackageJsonPath.AsLink());
				TypesUtils.MarkDirty();
			}
			else
				Debug.LogWarning("Installation failed: " + path);
		}

		public void Uninstall(ExportInfo exp = null)
		{
			exp = exp ? exp : Object.FindObjectOfType<ExportInfo>();
			if (!exp) return;
			var name = FindPackageName();
			if (PackageUtils.TryReadDependencies(exp.PackageJsonPath, out var deps))
			{
				if (deps.ContainsKey(name))
				{
					deps.Remove(name);
					if (PackageUtils.TryWriteDependencies(exp.PackageJsonPath, deps))
					{
						Debug.Log("<b>Removed package</b> " + name + " from " + exp.PackageJsonPath.AsLink());
					}
				}
			}
		}

		public Task<bool> RunInstall()
		{
			return Actions.InstallBundleTask(this);
		}

		internal void Save(string path)
		{
			var json = JsonConvert.SerializeObject(this, Formatting.Indented);
			File.WriteAllText(path, json);
			BundleRegistry.Instance.MarkDirty();
		}

		internal void FindImports(List<ImportInfo> list, [CanBeNull] string projectDirectory)
		{
			var packageDir = PackageDirectory;
			if (!Directory.Exists(packageDir)) return;
			var installed = projectDirectory == null || IsInstalled(projectDirectory + "/package.json");
			var startCount = list.Count;
			TypeScanner.FindTypes(packageDir, list, SearchOption.TopDirectoryOnly);
			RecursiveFindTypesIgnoringNodeModules(list, packageDir);
			for (var i = startCount; i < list.Count; i++)
				list[i].IsInstalled = installed;
		}

		internal IEnumerable<string> EnumerateDirectories(bool skipNodeModule = true, int maxLevel = 2)
		{
			IEnumerable<string> EnumerateDir(DirectoryInfo currentDirectory, int currentLevel)
			{
				if (!currentDirectory.Exists) yield break;
				if (skipNodeModule && currentDirectory.Name == "node_modules") yield break;
				if(currentDirectory.Name.EndsWith("codegen")) yield break;
				yield return currentDirectory.FullName;
				if (currentLevel >= maxLevel) yield break;
				var dirs = currentDirectory.GetDirectories();
				foreach (var d in dirs)
				{
					foreach (var sub in EnumerateDir(d, currentLevel + 1))
						yield return sub; 
				}
			}

			var dir = new DirectoryInfo(PackageDirectory);
			return EnumerateDir(dir, 0);
		}

		private static void RecursiveFindTypesIgnoringNodeModules(List<ImportInfo> list, string currentDir)
		{
			if (!Directory.Exists(currentDir)) return;
			foreach (var dir in Directory.EnumerateDirectories(currentDir))
			{
				if (dir.EndsWith("node_modules")) continue;
				TypeScanner.FindTypes(dir, list, SearchOption.TopDirectoryOnly);
				RecursiveFindTypesIgnoringNodeModules(list, dir);
			}
		}

		// private void FindCodeGenDirectory(ref DirectoryInfo dir)
		// {
		// 	if (dir?.Exists ?? false) return;
		// 	var currentDirectory = System.IO.Path.GetDirectoryName(FilePath);
		// 	Debug.Log(currentDirectory);
		// 	var folders = new string[] { currentDirectory };
		// 	var guids = AssetDatabase.FindAssets("t:" + nameof(AssemblyDefinitionAsset), folders);
		// 	foreach (var guid in guids)
		// 	{
		// 		var path = AssetDatabase.GUIDToAssetPath(guid);
		// 		var asset = AssetDatabase.LoadAssetAtPath<AssemblyDefinitionAsset>(path);
		// 		
		// 	} 
		// 	// while (currentDirectory != null)
		// 	// {
		// 	// 	foreach (var asmdefPath in Directory.EnumerateFiles(currentDirectory, "*.asmdef", SearchOption.TopDirectoryOnly))
		// 	// 	{
		// 	// 		// Compiler
		// 	// 	}
		// 	// }
		// }
	}
}