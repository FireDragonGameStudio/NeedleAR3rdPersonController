// using System;
// using System.IO;
// using System.Linq;
// using Needle.Engine.Projects;
// using Needle.Engine.Settings;
// using UnityEditor;
// using UnityEditorInternal;
// using UnityEngine;
//
// namespace Needle.Engine.Utils
// {
// 	internal static class ExportCompiledPackage
// 	{
// 		private const string threeVersion = "git://github.com/needle-tools/three.js.git#7e1a086e897fb78ae4f83d25f92b1305865ef815";
//
// 		[MenuItem("Needle/Tiny/Internal/Build Dll Only Package", true)]
// 		public static bool BuildNow_Validate() => ExporterProjectSettings.instance.debugMode;
//
// 		[MenuItem("Needle/Tiny/Internal/Build Dll Only Package", false, 10_000)]
// 		public static void BuildNow()
// 		{
// 			var packageDir = Application.dataPath + "/../../Compiled";
// 			var outputDir = Path.GetFullPath(packageDir + "/Content");
// 			var scriptAssemblyDirectory = Path.GetFullPath(Application.dataPath + "/../Library/ScriptAssemblies");
// 			var package = ProjectPaths.PackageDirectory?.Replace("\\", "/");
// 			if (package == null)
// 			{
// 				return;
// 			}
// 			if (Directory.Exists(outputDir))
// 				Directory.Delete(outputDir, true);
// 			var guids = AssetDatabase.FindAssets("t:" + nameof(AssemblyDefinitionAsset));
// 			foreach (var guid in guids)
// 			{
// 				var asmdefPath = AssetDatabase.GUIDToAssetPath(guid);
// 				if (!Path.GetFullPath(asmdefPath).Replace("\\", "/").Contains(package)) continue;
// 				var asset = AssetDatabase.LoadAssetAtPath<AssemblyDefinitionAsset>(asmdefPath);
// 				var instance = JsonUtility.FromJson<AssemblyDefinition>(asset.text);
// 				if (instance != null && !string.IsNullOrEmpty(instance.name))
// 				{
// 					// copy compiled asmdef
// 					var basePath = scriptAssemblyDirectory + "/" + instance.name;
// 					var dllPath = basePath + ".dll";
// 					CopyDllToOutput(dllPath, outputDir);
//
// 					// copy dlls that are in subdirectories of this asmdef (plugins being used)
// 					var dir = Path.GetDirectoryName(Path.GetFullPath(asmdefPath));
// 					if (dir == null) continue;
// 					var childDlls = Directory.EnumerateFiles(dir, "*.dll", SearchOption.AllDirectories);
// 					foreach (var ch in childDlls)
// 					{
// 						CopyDllToOutput(ch, outputDir);
// 					}
//
// 					// export asmrefs
// 					var childAsmrefs = Directory.EnumerateFiles(dir, "*.asmref", SearchOption.AllDirectories);
// 					foreach (var ch in childAsmrefs)
// 					{
// 						var asmrefDir = Path.GetDirectoryName(ch);
// 						if (string.IsNullOrEmpty(asmrefDir)) continue;
// 						var d = new DirectoryInfo(asmrefDir);
// 						CopyRecursively(new DirectoryInfo(asmrefDir), new DirectoryInfo(outputDir + "/" + d.Name));
// 					}
// 				}
// 			}
//
// 			var resources = AssetDatabase.FindAssets("t:" + nameof(ResourceReference));
// 			foreach (var guid in resources)
// 			{
// 				var path = AssetDatabase.GUIDToAssetPath(guid);
// 				var res = AssetDatabase.LoadAssetAtPath<ResourceReference>(path);
// 				if (res) res.ExportTo(outputDir);
// 			}
//
// 			var settings = ExporterProjectSettings.instance;
// 			if (settings && settings.localRuntimePackage != null && Directory.Exists(settings.localRuntimePackage))
// 			{
// 				var packageTargetDir = outputDir + "/../package~";
// 				CopyRecursively(
// 					new DirectoryInfo(settings.localRuntimePackage),
// 					new DirectoryInfo(packageTargetDir),
// 					null,
// 					d => d.Name != "node_modules");
// 				var packageJsonPath = packageTargetDir + "/package.json";
// 				if (File.Exists(packageJsonPath))
// 				{
// 					var content = File.ReadAllText(packageJsonPath);
// 					if (!string.IsNullOrWhiteSpace(threeVersion))
// 						content = content.Replace("file:../modules/three", threeVersion);
// 					File.WriteAllText(packageJsonPath, content);
// 				}
// 				else Debug.LogWarning("Could not find package json in " + packageTargetDir);
// 			}
// 			else Debug.LogError("Could not find local runtime package: " + settings.localRuntimePackage + ", please check ProjectSettings");
//
// 			Debug.Log("Finished precompiled export");
// 			Application.OpenURL(packageDir);
// 		}
//
//
//
// 		private static void CopyDllToOutput(string dllPath, string outputDir)
// 		{
// 			// var pdbPath = basePath + ".pdb";
// 			if (File.Exists(dllPath))
// 			{
// 				if (!Directory.Exists(outputDir)) Directory.CreateDirectory(outputDir);
// 				File.Copy(dllPath, outputDir + "/" + Path.GetFileName(dllPath), true);
// 			}
// 		}
//
// 		[Serializable]
// 		public class AssemblyDefinition
// 		{
// 			public string name;
// 		}
// 	}
// }