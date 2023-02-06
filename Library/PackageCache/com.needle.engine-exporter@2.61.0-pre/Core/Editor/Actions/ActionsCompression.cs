using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public static class ActionsCompression
	{
		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/Compress/Preview Build (Progressive + Compression)")]
		private static async void PreviewBuild()
		{
			var exportInfo = Object.FindObjectOfType<ExportInfo>();
			var directory = exportInfo ? Path.GetFullPath(exportInfo.GetProjectDirectory()) : "";
			using (new NeedleLock(directory))
			{
				await MakeProgressiveLocalFiles();
				await CompressLocalFiles();
			}
		}

		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/Compress/Apply Compression")]
		private static async void CompressLocalFilesMenu() => await CompressLocalFiles();
		internal static Task<bool> CompressLocalFiles()
		{
			var directory = Path.GetFullPath(ProjectInfo.GetAssetsDirectory());
			return CompressFiles(directory);
		}

		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/Compress/Make Progressive")]
		private static async void MakeProgressiveLocalFilesMenu() => await MakeProgressiveLocalFiles();
		private static Task MakeProgressiveLocalFiles()
		{
			var exportInfo = Object.FindObjectOfType<ExportInfo>();
			if (!exportInfo) return Task.CompletedTask;
			var assetsDirectory = Path.GetFullPath(ProjectInfo.GetAssetsDirectory());
			return MakeProgressive(assetsDirectory);
		}

		private const string TransformPackagePath = Constants.RuntimeNpmPackagePath + "/node_modules/@needle-tools/gltf-transform-extensions";

		[MenuItem("CONTEXT/" + nameof(ExportInfo) + "/Compress/Clear Caches", priority = 10_000)]
		private static async void ClearCaches()
		{
			if (EditorUtility.DisplayDialog("Clear Caches", "Are you sure you want to clear the gltf compression caches?", "Yes", "No, do not clear caches"))
			{
				var packageDirectory = Path.GetFullPath(TransformPackagePath);
				var cmd = "npm run clear-caches";
				await ProcessHelper.RunCommand(cmd, packageDirectory);
			}
		}

		internal static Task<bool> CompressFiles(string directoryOrFile)
		{
			if (!Directory.Exists(directoryOrFile) && !File.Exists(directoryOrFile)) return Task.FromResult(false);
			// var packageDirectory = @"C:\git\needle-gltf-extensions\package"; 
			var packageDirectory = Path.GetFullPath(TransformPackagePath);
			if (!Directory.Exists(packageDirectory)) return Task.FromResult(false);
			var cmd = "npm run transform:pack-gltf \"" + directoryOrFile + "\"";
			return ProcessHelper.RunCommand(cmd, packageDirectory);
		}

		internal static async Task<bool> MakeProgressive(string directory)
		{
			if (!Directory.Exists(directory)) return false;
			foreach (var glb in Directory.EnumerateFiles(directory, "*.glb", SearchOption.AllDirectories))
			{
				var fileName = new FileInfo(glb);
				if (fileName.Name.StartsWith("image_")) continue;
				if (!await MakeProgressiveSingle(glb))
				{
					Debug.LogWarning("Failed compressing " + glb);
				}
			}
			return true;
		}

		internal static Task<bool> MakeProgressiveSingle(string glbPath)
		{
			glbPath = Path.GetFullPath(glbPath).Replace("\\", "/");
			var cmd = "npm run transform:make-progressive \"" + glbPath + "\"";
			var packageDirectory = Path.GetFullPath(TransformPackagePath);
			Debug.Log("<b>Begin transform progressive</b>: " + glbPath + "\n" + packageDirectory);
			var task = ProcessHelper.RunCommand(cmd, packageDirectory);
			task.ContinueWith(t => Debug.Log("<b>End transform progressive</b>: " + glbPath));
			return task;
		}

		// private static readonly Regex makeProgressiveNodeDirectory = new Regex("\"transform:make-progressive\": \"node (?<path>.+)\"?");
		//
		// /// <summary>
		// /// Get script location for progressive texture conversion from engine package json
		// /// e.g. "transform:make-progressive": "node C:/git/needle-gltf-extensions/package/make-progressive.mjs",
		// /// If the string after node is not found it will fallback to use the engine directory
		// /// </summary>
		// private static string GetProgressiveTextureScriptDirectory(string dir)
		// {
		// 	var packageJson = Path.GetFullPath(dir + "/package.json");
		// 	if (File.Exists(packageJson))
		// 	{
		// 		var text = File.ReadAllText(packageJson);
		// 		var match = makeProgressiveNodeDirectory.Match(text);
		// 		if (match.Success)
		// 		{
		// 			var path = match.Groups["path"].Value;
		// 			if (File.Exists(path))
		// 			{
		// 				return Path.GetDirectoryName(path);
		// 			}
		// 		}
		// 	}
		// 	// default is engine directory
		// 	return dir + "/node_modules/@needle-tools/engine";
		// }
	}
}