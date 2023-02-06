using System.Collections.Generic;
using System.IO;
using Unity.Profiling;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Core
{
	internal class AssetDependency : IAssetDependencyInfo
	{
		private static ProfilerMarker buildAssetMarker = new ProfilerMarker("AssetDependency: Build");
		private static ProfilerMarker calculateChangedAssetsMarker = new ProfilerMarker("AssetDependency: DetectChanges");

		private static readonly HashSet<string> visited = new HashSet<string>();
		private static readonly Dictionary<string, string> cachedHashes = new Dictionary<string, string>();

		public static void ClearCaches()
		{
			cachedHashes.Clear();
		}

		internal static AssetDependency Get(string path, string cacheDirectory)
		{
			AssetDependency dep;
			
			using (buildAssetMarker.Auto())
			{
				visited.Clear();
				dep = RecursiveBuildGraph(path);
			}
			
			using (calculateChangedAssetsMarker.Auto())
			{
				visited.Clear();
				dep.DetectChanges(cacheDirectory);
			}
			
			return dep;
		}

		private static AssetDependency RecursiveBuildGraph(string path, AssetDependency parent = null)
		{
			if (visited.Contains(path)) return null;
			visited.Add(path);

			var currentNode = new AssetDependency(path, parent);
			var deps = AssetDatabase.GetDependencies(path, false);
			foreach (var dep in deps)
			{
				if (dep == path) continue;
				// if (dep.EndsWith(".cs")) continue;
				RecursiveBuildGraph(dep, currentNode);
			}

			return currentNode;
		}

		public bool HasChanged => hasChanged;

		public void WriteToCache()
		{
			if (!string.IsNullOrEmpty(hashFilePath) && !string.IsNullOrEmpty(assetHash))
			{
				if (hasChanged)
				{
					if (hashDirectory == null) hashDirectory = Path.GetDirectoryName(hashFilePath);
					if (hashDirectory != null)
						Directory.CreateDirectory(hashDirectory);
					var content = assetHash;
					content += "\n" + combinedHash;
					content += "\n" + path;
					File.WriteAllText(hashFilePath, content);
				}
				
				if(!cachedHashes.ContainsKey(hashFilePath))
					cachedHashes.Add(hashFilePath, assetHash);
				else cachedHashes[hashFilePath] = assetHash;
			}
		}

		/// <summary>
		/// Call to save the hash of this asset and all its children
		/// </summary>
		internal void WriteToCacheAll()
		{
			WriteToCache();
			foreach (var ch in children)
				ch.WriteToCacheAll();
		}

		public readonly string path;
		public readonly string assetHash;
		public readonly string guid;

		/// <summary>
		/// Hash combining all children hashes
		/// </summary>
		private string combinedHash;

		private readonly AssetDependency parent;
		private readonly List<AssetDependency> children = new List<AssetDependency>();

		private string hashFilePath = null;
		private string hashDirectory = null;
		private bool hasChanged = false;

		private AssetDependency(string path, AssetDependency parent)
		{
			this.path = path;
			assetHash = AssetDatabase.GetAssetDependencyHash(path).ToString();
			guid = AssetDatabase.AssetPathToGUID(path);
			this.parent = parent;
			if (parent != null) parent.children.Add(this);
		}

		private bool didDetectChanges = false;
		private static readonly Dictionary<string, string> guidPathCache = new Dictionary<string, string>();
		private static readonly Dictionary<string, StreamReader> readers = new Dictionary<string, StreamReader>();

		private bool DetectChanges(string cacheDirectory)
		{
			if (didDetectChanges) return hasChanged;
			didDetectChanges = true;

			// ensure that we dont visit the same asset twice
			if (visited.Contains(this.path))
			{
				return false;
			}
			visited.Add(this.path);


			var changed = false;
			combinedHash = assetHash;

			foreach (var ch in children)
			{
				changed |= ch.DetectChanges(cacheDirectory);
				combinedHash += ch.combinedHash;
			}

			var hash = new Hash128();
			hash.Append(combinedHash);
			combinedHash = hash.ToString();

			string hashPath;
			if (!guidPathCache.TryGetValue(guid, out hashPath))
			{
				hashPath = cacheDirectory + "/" + guid + ".hash";
				guidPathCache.Add(guid, hashPath);
			}
			hashFilePath = hashPath;
			hashDirectory = cacheDirectory;

			
			if (!cachedHashes.TryGetValue(hashPath, out var cachedHash))
			{
				if (File.Exists(hashPath))
				{
					using var reader = File.OpenText(hashPath);
					cachedHash = reader.ReadLine();
				}
				
				cachedHashes.Add(hashPath, cachedHash);
			}
			
			if (string.IsNullOrEmpty(cachedHash) || cachedHash != assetHash)
			{
				changed = true;
			}
			
			
			
			if (changed) hasChanged = true;
			return changed;
		}
	}
}