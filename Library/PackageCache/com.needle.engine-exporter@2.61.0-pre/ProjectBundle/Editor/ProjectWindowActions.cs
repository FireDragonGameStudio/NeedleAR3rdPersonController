using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Needle.Engine.Codegen;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.ProjectWindowCallback;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;
using Task = System.Threading.Tasks.Task;

namespace Needle.Engine.ProjectBundle
{
	internal static class ProjectWindowActions
	{
		private const string BaseMenuPath = "Assets/Create/";
		private const int BaseMenuPriority = Engine.Constants.MenuItemOrder;

		private class CreateTypescriptAction : EndNameEditAction
		{
			public string Directory;
			public string Template;
			
			/// <summary>
			/// optional codegen dir
			/// </summary>
			public string CodeGenDirectory;

			/// <summary>
			/// optional path to npmdef
			/// </summary>
			public string NpmDefPath;

			public override async void Action(int instanceId, string pathName, string resourceFile)
			{
				var fileName = Path.GetFileNameWithoutExtension(pathName);
				SanitizeName(ref fileName);

				var targetPath = Directory + "/" + fileName + ".ts";
				if (File.Exists(targetPath))
				{
					Debug.LogWarning("Script already exists at " + targetPath);
					// fileName = ObjectNames.GetUniqueName(new[] { fileName }, fileName);
					// SantizeName(ref fileName);
					// targetPath = Directory + "/" + fileName + ".ts";
				}
				else
				{
					var code = Template.Replace("component_name", fileName);
					File.WriteAllText(targetPath, code);
					if (!string.IsNullOrWhiteSpace(CodeGenDirectory))
						System.IO.Directory.CreateDirectory(CodeGenDirectory);
				}

				// TODO: select the new typescript sub asset
				if (!string.IsNullOrEmpty(NpmDefPath) && File.Exists(NpmDefPath))
				{
					// AssetDatabase.AssetPathToGUID(NpmDefPath)
				}

				var workspaceDirectory = Directory;
				if (!Actions.OpenWorkspace(workspaceDirectory, true))
				{
					Debug.LogWarning("Failed opening workspace: " + Directory);
				}
				await Task.Delay(100);
				EditorUtility.OpenWithDefaultApp(targetPath);

				BundleRegistry.Instance.RunCodeGen(targetPath);

				var fp = Path.GetFullPath(Directory);
				var bundle = BundleRegistry.Instance.Bundles.FirstOrDefault(b => b.PackageDirectory == fp);
				if (bundle != null)
				{
					BundleImporter.MarkDirty(bundle);
				}
			}

			private static void SanitizeName(ref string str)
			{
				str = Regex.Replace(str, "[\\W]", "");
			}
		}

		[MenuItem(BaseMenuPath + "Typescript", true, BaseMenuPriority + 1)]
		private static bool CreateTypescript_Validate()
		{
			var obj = Selection.activeObject;
			var selectionPath = AssetDatabase.GetAssetPath(obj);
			if (selectionPath.EndsWith(Constants.Extension) || selectionPath.EndsWith(".codegen")) return true;
			var exportInfo = Object.FindObjectOfType<ExportInfo>();
			if (exportInfo && exportInfo.Exists()) return true;
			return false;
		}

		[MenuItem(BaseMenuPath + "Typescript", false, BaseMenuPriority + 1)]
		private static void CreateTypescript()
		{
			var obj = Selection.activeObject;
			var selectionPath = AssetDatabase.GetAssetPath(obj);
			
			var path = AssetDatabase.GUIDToAssetPath("921c8f326fb84c89b6cb2cee80d99e31");
			var template = File.ReadAllText(path);
			
			var creator = ScriptableObject.CreateInstance<CreateTypescriptAction>();
			creator.Template = template;
			
			if (selectionPath.EndsWith(Constants.Extension) || selectionPath.EndsWith(".codegen"))
			{
				var projectPath = selectionPath.Substring(0, selectionPath.LastIndexOf(".", StringComparison.Ordinal)) + "~";
				if (Directory.Exists(projectPath))
				{
					creator.NpmDefPath = selectionPath.Substring(0, selectionPath.LastIndexOf(".", StringComparison.Ordinal)) + Constants.Extension;
					creator.Directory = projectPath;
					creator.CodeGenDirectory = selectionPath.Substring(0, selectionPath.LastIndexOf(".", StringComparison.Ordinal)) + ".codegen";
					ProjectWindowUtil.StartNameEditingIfProjectWindowExists(0, creator, "New Typescript", null, null);
				}
			}
			else
			{
				var exportInfo = Object.FindObjectOfType<ExportInfo>();
				var dir = Path.GetFullPath(exportInfo.GetProjectDirectory() + "/src/scripts");
				if (Directory.Exists(dir))
				{
					creator.Directory = dir;
					ProjectWindowUtil.StartNameEditingIfProjectWindowExists(0, creator, "New Typescript", null, null);
				}
			}
		}

		[MenuItem(BaseMenuPath + "NPM Definition", false, BaseMenuPriority + 2)]
		private static void CreateBundleContextMenu()
		{
			var obj = Selection.activeObject;
			if (obj)
			{
				CreateBundle();
			}
		}

		private class CreateAssetAction : EndNameEditAction
		{
			public override void Action(int instanceId, string pathName, string resourceFile)
			{
				var bundleFilePath = pathName + Constants.Extension;
				var fileName = Path.GetFileNameWithoutExtension(bundleFilePath);

				var bundle = new Bundle();
				bundle.FilePath = bundleFilePath;
				// bundle.Path = fileName + "~";
				var json = JsonConvert.SerializeObject(bundle, Formatting.Indented);
				File.WriteAllText(bundleFilePath, json);
				AssetDatabase.ImportAsset(bundleFilePath, ImportAssetOptions.ForceSynchronousImport);
				var res = AssetDatabase.LoadAssetAtPath<Object>(bundleFilePath);
				ProjectWindowUtil.ShowCreatedAsset(res);

				var packageDirectory = pathName + "~";
				CreateBasicNpmPackageAt(packageDirectory, fileName);

				CreateGitignore(packageDirectory);
				CreateDefaultWorkspace(packageDirectory);
				CreateTsConfigTemplate(packageDirectory);

				Actions.InstallBundle(bundle);
			}
		}

		public static void CreateBundle()
		{
			var creator = ScriptableObject.CreateInstance<CreateAssetAction>();
			ProjectWindowUtil.StartNameEditingIfProjectWindowExists(0, creator, "New NpmDef", null, null);
		}

		public static void CreateNpmPackageAt(string packageDirectory)
		{
			Directory.CreateDirectory(packageDirectory);
			if (File.Exists(packageDirectory + "/package.json"))
			{
				return;
			}
			var si = new ProcessStartInfo();
			si.WorkingDirectory = packageDirectory;
			si.FileName = "cmd";
			si.Arguments = "/c npm init";
			Process.Start(si);
		}

		public static void CreateBasicNpmPackageAt(string packageDirectory, string name)
		{
			name = Regex.Replace(name, "[\\s]", "-").ToLowerInvariant();

			Directory.CreateDirectory(packageDirectory);
			var path = packageDirectory + "/package.json";
			if (File.Exists(path))
			{
				Debug.LogError("Can not create new package: package.json already exists at " + path.AsLink());
				return;
			}
			var package = new NpmPackageJson()
			{
				name = name,
				version = "1.0.0"
			};
			package.peerDependencies.Add(Engine.Constants.RuntimeNpmPackageName, ">= 1.0.0-pre");
			package.peerDependencies.Add("three", "^0.130");
			package.devDependencies.Add(Engine.Constants.RuntimeNpmPackageName, "^1.0.0-pre");
			package.devDependencies.Add("three", "^0.140");
			// index.ts
			const string indexGuid = "3c5c10ecab85408fab4d6492a7895015";
			var indexPath = AssetDatabase.GUIDToAssetPath(indexGuid);
			if (File.Exists(indexPath) && indexPath.EndsWith(".ts"))
			{
				File.Copy(indexPath, packageDirectory + "/index.ts");
				package.main = "index.ts";
			}
			// var runtimePackagePath = ExporterProjectSettings.instance.localRuntimePackage;
			// if (Directory.Exists(runtimePackagePath))
			// {
			// 	runtimePackagePath = Path.GetFullPath(runtimePackagePath);
			// 	runtimePackagePath = new Uri(Path.GetFullPath(packageDirectory + "/")).MakeRelativeUri(new Uri(runtimePackagePath)).ToString();
			// 	package.devDependencies.Add(Tiny.Constants.RuntimeNpmPackageName, "file:" + runtimePackagePath);
			// }
			var json = JsonConvert.SerializeObject(package, Formatting.Indented);
			File.WriteAllText(path, json);
		}

		private class NpmPackageJson
		{
			public string name;
			public string version;
			public string main;
			public Dictionary<string, string> dependencies = new Dictionary<string, string>();
			public Dictionary<string, string> peerDependencies = new Dictionary<string, string>();
			public Dictionary<string, string> devDependencies = new Dictionary<string, string>();
		}

		public static void CreateDefaultWorkspace(string packageDirectory)
		{
			var templatePath = AssetDatabase.GUIDToAssetPath("91caacf95048482080bf4b39313474ba");
			if (string.IsNullOrEmpty(templatePath)) return;
			var template = AssetDatabase.LoadAssetAtPath<TextAsset>(templatePath);
			if (!template) return;
			var workspacePath = packageDirectory + "/workspace.code-workspace";
			if (File.Exists(workspacePath)) return;
			File.WriteAllText(workspacePath, template.text);
		}

		public static void CreateTsConfigTemplate(string packageDirectory)
		{
			var templatePath = AssetDatabase.GUIDToAssetPath("b5518772aa40416ea40cd882860c24e4");
			if (string.IsNullOrEmpty(templatePath)) return;
			var template = AssetDatabase.LoadAssetAtPath<TextAsset>(templatePath);
			if (!template) return;
			var path = packageDirectory + "/tsconfig.json";
			if (File.Exists(path)) return;
			File.WriteAllText(path, template.text);
		}

		public static void CreateGitignore(string packageDirectory)
		{
			var templatePath = AssetDatabase.GUIDToAssetPath("8a0f3f921f064605a4eb0f260ea47acf");
			if (string.IsNullOrEmpty(templatePath)) return;
			var template = File.ReadAllText(templatePath);
			if (string.IsNullOrEmpty(template)) return;
			var path = packageDirectory + "/.gitignore";
			if (File.Exists(path)) return;
			File.WriteAllText(path, template);
		}
	}
}