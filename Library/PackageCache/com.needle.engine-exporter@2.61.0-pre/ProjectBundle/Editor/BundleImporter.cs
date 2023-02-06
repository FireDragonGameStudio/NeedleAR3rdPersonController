using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Settings;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Needle.Engine.ProjectBundle
{
	[ScriptedImporter(5, Constants.Extension, importQueueOffset: 5_000)]
	public class BundleImporter : ScriptedImporter
	{
		public override void OnImportAsset(AssetImportContext ctx)
		{
			if (BundleRegistry.Register(ctx.assetPath))
			{
				BundleRegistry.Instance.MarkDirty();
				if(ExporterProjectSettings.instance.debugMode)
					Debug.Log("Registered " + ctx.assetPath);

				var so = ScriptableObject.CreateInstance<NpmDefObject>();
				ctx.AddObjectToAsset("main", so);
				ctx.SetMainObject(so);
				
				TypescriptRegistry.MarkDirty(ctx.assetPath);

				var json = File.ReadAllText(ctx.assetPath);
				var bundle = JsonConvert.DeserializeObject<Bundle>(json);
				if (bundle != null)
				{
					bundle.FilePath = ctx.assetPath;
					ctx.DependsOnCustomDependency(bundle.PackageFilePath.Replace("\\", "/"));
					
					var list = new List<ImportInfo>();
					bundle.FindImports(list, null);
					BuildTypescriptSubAssets(ctx, bundle, list);
					DeleteGeneratedComponentsWithoutScript(bundle, list);
				}
			}
		}

		private static void BuildTypescriptSubAssets(AssetImportContext ctx, Bundle bundle, IList<ImportInfo> list)
		{
			// var dir = bundle.PackageDirectory + "/";
			var codeGenDirectory = bundle.FindScriptGenDirectory();
			foreach (var import in list)
			{
				var ts = ScriptableObject.CreateInstance<Typescript>();
				ts.name = import.TypeName;
				ts.Path = import.FilePath;// PathUtils.MakeRelative(dir, import.FilePath, false);
				ts.CodeGenDirectory = codeGenDirectory;
				ts.NpmDefPath = ctx.assetPath;
				var id = $"{import.RelativeTo(bundle.PackageDirectory)}_{import.TypeName}";
				ctx.AddObjectToAsset(id, ts);
			}
		}

		private static void DeleteGeneratedComponentsWithoutScript(Bundle bundle, IList<ImportInfo> list)
		{
			var deleted = false;
			var dir = bundle?.FindScriptGenDirectory();
			if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
			var info = new DirectoryInfo(dir);
			foreach (var script in info.GetFiles("*.cs"))
			{
				var name = Path.GetFileNameWithoutExtension(script.Name);
				if (!list.Any(i => i.TypeName == name))
				{
					deleted = true;
					Debug.Log("<b>Delete generated component</b>: " + name + " at " + script);
					FileUtil.DeleteFileOrDirectory(script.FullName);
					var metaPath = script + ".meta";
					if (File.Exists(metaPath)) File.Delete(metaPath);
				}
			}

			if (info.EnumerateFileSystemInfos().ToArray().Length <= 0)
			{
				Directory.Delete(dir);
				var directoryMeta = dir + ".meta";
				if (File.Exists(directoryMeta))
					File.Delete(directoryMeta);
				deleted = true;
			}

			if (deleted)
			{
				EditorApplication.delayCall += () => AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
			}
		}


		internal static void MarkDirty(Bundle bundle)
		{
			MarkDirty(bundle.PackageFilePath);
		}

		internal static void MarkDirty(string packageFilePath)
		{
			var hash = Hash128.Compute(Random.value);
			var id = packageFilePath.Replace("\\", "/");
			AssetDatabase.RegisterCustomDependency(id, hash);
			AssetDatabase.Refresh();
		}
	}
}