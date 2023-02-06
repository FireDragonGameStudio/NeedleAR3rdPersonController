using System;
using System.IO;
using UnityEngine;

namespace Needle.Engine.Core
{
	/// <summary>
	/// Used to cache previously exported glb on building a dist. Can be used with SmartExport to restore a glb that hasnt changed from cache (because we clear the assets directory before building a dist)
	/// </summary>
	internal static class AssetDependencyCache
	{
		internal static bool IsSupported => false;
		
		/// <summary>
		/// Call before clearing assets to backup the glb files
		/// </summary>
		internal static void CacheDirectory(string pathToDirectory)
		{
			// TODO: to make this work we need to make sure we also store the dependencies of the glb files (for example a glb might reference a mp3)
			// try
			// {
			// 	if (!Directory.Exists(pathToDirectory))
			// 		return;
			//
			// 	foreach (var file in Directory.EnumerateFiles(pathToDirectory))
			// 	{
			// 		// We can not cache gltf right now since they are multiple files (gltf + bin + textures) and we dont collect the dependencies here (yet) - it would be possible to collect them and cache them in a subfolder and on resolve we can just take all files in the folder with the correct name and move them to the output directory
			// 		if (file.EndsWith(".glb"))
			// 			CacheFile(file);
			// 	}
			// }
			// catch
			// {
			// 	// ignore
			// }
		}

		/// <summary>
		/// Call after export to clear the cache
		/// </summary>
		internal static void ClearCache()
		{
			var targetDir = CacheDirectoryPath;
			if (Directory.Exists(targetDir))
				Directory.Delete(targetDir, true);
		}

		/// <summary>
		/// Call during export when detecting an unchanged file - before re-export we can try to restore it from the cache
		/// </summary>
		/// <param name="outputPath">The expected output path that you would export to</param>
		/// <returns>True if he file has been restored and you dont need to re-export</returns>
		internal static bool TryRestoreFromCache(string outputPath)
		{
			var cacheFile = GetCachePath(outputPath, false);
			if (File.Exists(cacheFile))
			{
				File.Move(cacheFile, outputPath);
				return true;
			}
			return false;
		}

		private static string CacheDirectoryPath => Application.dataPath + "/../Temp/Needle/AssetCacheExport";

		private static void CacheFile(string pathToFile)
		{
			var targetFile = GetCachePath(pathToFile, true);
			File.Move(pathToFile, targetFile);
		}

		private static string GetCachePath(string pathToFile, bool createDir)
		{
			var targetDir = CacheDirectoryPath;
			if (createDir)
				Directory.CreateDirectory(targetDir);
			else if (!Directory.Exists(targetDir)) return null;
			var targetFile = targetDir + "/" + Path.GetFileName(pathToFile);
			return targetFile;
		}
	}
}