using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Projects
{
	public struct ProjectGenerationOptions
	{
		public bool StartAfterGeneration;
		public IList<Dependency> Dependencies;
	}

	public static class ProjectGenerator
	{
		private static List<ProjectTemplate> _templates;

		public static List<ProjectTemplate> Templates
		{
			get
			{
				if (_templates == null) RefreshTemplates();
				return _templates;
			}
		}

		public static void RefreshTemplates()
		{
			_templates ??= new List<ProjectTemplate>();
			_templates.Clear();
			var templateAssets = AssetDatabase.FindAssets("t:" + nameof(ProjectTemplate));
			foreach (var tmp in templateAssets)
			{
				var loaded = AssetDatabase.LoadAssetAtPath<ProjectTemplate>(AssetDatabase.GUIDToAssetPath(tmp));
				if (loaded) _templates.Add(loaded);
			}
			_templates.Sort((a, b) => b.Priority - a.Priority);
		}

		public static Task CreateFromTemplate(string projectDir)
		{
			var path = AssetDatabase.GUIDToAssetPath("456ab5d794b090d4ba4ce834e45a436e");
			return CreateFromTemplate(projectDir, path);
		}

		public static Task CreateFromTemplate(string projectDir, ProjectTemplate template, ProjectGenerationOptions? options = default)
		{
			return CreateFromTemplate(projectDir, template.GetPath(), options);
		}

		public static async Task CreateFromTemplate(string projectDir, string templateDir, ProjectGenerationOptions? options = default)
		{
			if (!Directory.Exists(templateDir))
			{
				Debug.LogError("Template not found at " + Path.GetFullPath(templateDir));
				return;
			}
			Analytics.RegisterNewProject(projectDir, new DirectoryInfo(templateDir).Name);
			projectDir = Path.GetFullPath(projectDir);
			if (!Directory.Exists(projectDir)) Directory.CreateDirectory(projectDir);
			CopyTemplate(templateDir, projectDir);
			await PostProcessProjectAndRun(projectDir, options);
		}

		private static async Task PostProcessProjectAndRun(string projectDir, ProjectGenerationOptions? options)
		{
			var export = Object.FindObjectOfType<ExportInfo>();
			if (!export)
			{
				var go = new GameObject("Export");
				go.tag = "EditorOnly";
				export = go.AddComponent<ExportInfo>();
			}
			export.DirectoryName = new Uri(Application.dataPath).MakeRelativeUri(new Uri(projectDir)).ToString();
			export.DirectoryName = export.DirectoryName.Replace("%20", " ");

			if (options?.Dependencies != null)
			{
				var packageJsonPath = projectDir + "/package.json";
				foreach (var dep in options?.Dependencies)
					dep.Install(packageJsonPath);
			}

			await Actions.InstallPackage(false, false);
			if (options == null || options.Value.StartAfterGeneration)
			{
				var success = await Builder.Build(false, BuildContext.LocalDevelopment);
				if (success)
				{
					MenuItems.StartDevelopmentServer();
					Application.OpenURL(projectDir);
				}
			}
		}

		private static void CopyTemplate(string sourcePath, string targetPath)
		{
			var sb = new System.Text.StringBuilder(); 
			sb.AppendLine("Copying template from " + sourcePath);
			try
			{
				var paths = Directory.GetDirectories(sourcePath, "*", SearchOption.AllDirectories);
				for (var index = 0; index < paths.Length; index++)
				{
					var dirPath = paths[index];
					if (EditorUtility.DisplayCancelableProgressBar("Copy Template", "Create directories", (float)index / paths.Length))
					{
						Debug.Log("Cancelled copying template");
						return;
					}
					Directory.CreateDirectory(dirPath.Replace(sourcePath, targetPath));
				}
				var files = Directory.GetFiles(sourcePath, "*.*", SearchOption.AllDirectories);
				for (var index = 0; index < files.Length; index++)
				{
					var filePath = files[index];
					if (filePath.EndsWith(".meta")) continue;
					// skip template
					if (filePath.EndsWith(".asset") && AssetDatabase.GetMainAssetTypeAtPath(filePath) == typeof(ProjectTemplate)) continue;
					var target = filePath.Replace(sourcePath, targetPath);
					sb.AppendLine("Copying file: " + target);
					if (EditorUtility.DisplayCancelableProgressBar("Copy Template", "Copy " + filePath + " to " + target, (float)index / files.Length))
					{
						Debug.Log("Cancelled copying template");
						return;
					}
					File.Copy(filePath, target, true);
				}
			}
			catch (Exception ex)
			{
				Debug.LogException(ex);
			}
			finally
			{
				EditorUtility.ClearProgressBar();
				sb.AppendLine("Copying Template: Done");
				Debug.Log(sb);
			}
		}

		public static event Action<string> ReplacingVariablesInFile;

		public static async Task ReplaceVariables(string filePath)
		{
			const string runtimePackageVariable = "<needle-runtime-package>";
			const string threejsPackageVariable = "<threejs-package>";

			if (filePath.EndsWith("package.json"))
			{
				var runtimePath = ProjectPaths.NpmPackageDirectory;
				var threejsPath = ProjectPaths.LocalThreejsModule;
				
				if (string.IsNullOrWhiteSpace(threejsPath) || !Directory.Exists(threejsPath))
				{
					var engineThreejsPath = runtimePath + "/node_modules/three";
					if (Directory.Exists(engineThreejsPath))
					{
						threejsPath = engineThreejsPath;
					}
				}
				
				var content = File.ReadAllText(filePath);
				if (runtimePath != null || threejsPath != null)
				{
					if (runtimePath != null)
					{
						var var = runtimePath;
						if (Directory.Exists(var))
							var = "file:" + PathUtils.MakeRelative(filePath, runtimePath);// new Uri(filePath).MakeRelativeUri(new Uri(Path.GetFullPath(runtimePath)));
						Debug.Log("Setting module path for Needle Engine to: " + var + "\nin " + filePath);
						var packageName = Regex.Escape(Constants.RuntimeNpmPackageName);
						content = Regex.Replace(content, $"(\"{packageName}\":\\s?\")(.+)(\")", "$1" + var + "$3");

						// make sure the runtime package is installed so we can replace the threejs path below which should exist then
						await ProcessHelper.RunCommand(NpmUtils.GetInstallCommand(), runtimePath);
					}
					
					if (threejsPath != null)
					{
						var var = threejsPath;
						var replacePath = true;

						if (PackageUtils.GetDependencyValue(content, "three", out var value))
						{
							if (string.IsNullOrEmpty(value)) replacePath = true;
							else if (PackageUtils.TryGetPath(Path.GetDirectoryName(filePath), value, out var fp))
							{
								if (File.Exists(fp + "/package.json"))
									replacePath = false;
							}
							else if (value.Contains(".git") || value.StartsWith("git"))
								replacePath = false;
						}

						if (replacePath)
						{
							if (Directory.Exists(threejsPath))
							{
								var = "file:" + PathUtils.MakeRelative(filePath, threejsPath);// new Uri(filePath).MakeRelativeUri(new Uri(Path.GetFullPath(threejsPath)));
								Debug.Log("Setting module path for three.js to: " + var);
								content = Regex.Replace(content, "(\"three\":\\s?\")(.*)(\")", "$1" + var + "$3");
							}
						}
						// content = content.Replace(threejsPackageVariable, var);
					}
					File.WriteAllText(filePath, content);
				}

				if (content.Contains(runtimePackageVariable))
				{
					Debug.LogError("Missing path or version of needle runtime package at " + filePath.AsLink() +
					               " - make sure to assign correct paths in ProjectSettings");
				}
				if (content.Contains(threejsPackageVariable))
				{
					Debug.LogError("Missing path or version of threejs at " + filePath.AsLink() +
					               " - make sure to assign correct paths in ProjectSettings".AsLink());
				}
			}

			ReplacingVariablesInFile?.Invoke(filePath);
		}
	}
}