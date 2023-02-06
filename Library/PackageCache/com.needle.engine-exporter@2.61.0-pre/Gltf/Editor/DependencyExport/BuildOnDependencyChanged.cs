// using System;
// using System.Collections.Generic;
// using System.IO;
// using System.Linq;
// using Needle.Engine.Core;
// using Needle.Engine.Gltf;
// using Needle.Engine.Settings;
// using Unity.Profiling;
// using UnityEditor;
// using UnityEngine;
// using UnityEngine.SceneManagement;
// using Object = UnityEngine.Object;
//
// namespace Needle.Engine.Utils
// {
// 	public class BuildOnDependencyChanged : UnityEditor.AssetModificationProcessor
// 	{
// 		private static DateTime lastSave = DateTime.MinValue;
//
// 		private static string[] OnWillSaveAssets(string[] paths)
// 		{
// 			if (Builder.IsBuilding) return paths;
// 			var now = DateTime.Now;
// 			if (now - lastSave < TimeSpan.FromSeconds(1)) return paths;
// 			lastSave = now;
// 			// EditorApplication.delayCall += () => DetectSceneAssetDependencyChange(true);
// 			return paths;
// 		}
//
// 		[InitializeOnLoadMethod]
// 		private static void Init()
// 		{
// 			Builder.BuildEnded += OnEnded;
// 		}
//
// 		private static void OnEnded()
// 		{
// 			if (ExporterProjectSettings.instance.exportOnDependencyChangeExperimental == false)
// 				return;
// 			DetectSceneAssetDependencyChange(false);
// 		}
//
// 		private static readonly List<AssetDependency> tempList = new List<AssetDependency>();
// 		private static ProfilerMarker _hashMarker = new ProfilerMarker("Calculate Scene Dependency Graph");
//
// 		private static void DetectSceneAssetDependencyChange(bool allowExport)
// 		{
// 			if (ExporterProjectSettings.instance.exportOnDependencyChangeExperimental == false)
// 				return;
// 			var obj = Object.FindObjectOfType<ExportInfo>();
// 			if (obj)
// 			{
// 				var projectDirectory = obj.GetProjectDirectory();
// 				if (!Directory.Exists(projectDirectory)) return;
// 				var currentScenePath = SceneManager.GetActiveScene().path;
// 				var cacheDir = obj.GetCacheDirectory();
// 				EnsureCacheDirectoryIsIgnored(projectDirectory, cacheDir);
//
// 				using (_hashMarker.Auto())
// 				{
// 					tempList.Clear();
// 					var graph = AssetDependency.Get(currentScenePath);
// 					var changed = graph.DetectChanges(cacheDir, tempList);
// 					Debug.Log(changed);
// 					graph.WriteToCache();
// 				}
// 			}
// 		}
//
// 		// private static void FilterUniquePaths(IEnumerable<AssetDependency> assets, ICollection<string> uniquePaths)
// 		// {
// 		// 	foreach (var asset in assets)
// 		// 	{
// 		// 		if (!uniquePaths.Contains(asset.path)) uniquePaths.Add(asset.path);
// 		// 	}
// 		// 	// Debug.Log("Detected " + changedPaths.Count + " asset change/s in " + string.Join("\n", changedPaths));
// 		// }
//
// 		// private static void HandleChangedAsset(AssetDependency asset, ICollection<string> visited, string projectDirectory)
// 		// {
// 		// 	var originalPath = asset?.path;
// 		// 	asset = GetNextExportable(asset);
// 		// 	if (asset == null) return;
// 		// 	if (visited.Contains(asset.path)) return;
// 		// 	var path = asset.path;
// 		// 	visited.Add(path);
// 		// 	var instance = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(path);
// 		// 	if (instance)
// 		// 	{
// 		// 		// do want to force to export this asset again since is has a changed dependency
// 		// 		// so if internally the cache is asked if it has changed (e.g. in GltfReferenceResolver)
// 		// 		// it should not find a cached has so it continues on exporting the asset
// 		// 		// asset.DeleteCachedHash();
// 		// 		
// 		// 		// if (Export.AsGlb(instance, out _, true, projectDirectory))
// 		// 		// {
// 		// 		// 	Debug.Log($"Did export \"{Path.GetFileName(path)}\" because \"{originalPath}\" changed", instance);
// 		// 		// }
// 		// 	}
// 		// }
// 		//
// 		// private static AssetDependency GetExportableRoot(AssetDependency asset)
// 		// {
// 		// 	var exportable = default(AssetDependency);
// 		// 	var currentScenePath = SceneManager.GetActiveScene().path;
// 		// 	while (asset != null)
// 		// 	{
// 		// 		if (currentScenePath != asset.path && IsExportableAsset(asset.path))
// 		// 		{
// 		// 			exportable = asset;
// 		// 		}
// 		// 		asset = asset.parent;
// 		// 	}
// 		// 	return exportable;
// 		// }
// 		//
// 		// private static AssetDependency GetNextExportable(AssetDependency asset)
// 		// {
// 		// 	while (asset != null)
// 		// 	{
// 		// 		if (IsExportableAsset(asset.path)) return asset;
// 		// 		asset = asset.parent;
// 		// 	}
// 		// 	return null;
// 		// }
// 		//
// 		// private static bool IsExportableAsset(string path)
// 		// {
// 		// 	return path.EndsWith(".unity") || path.EndsWith(".prefab");
// 		// }
// 	}
// }