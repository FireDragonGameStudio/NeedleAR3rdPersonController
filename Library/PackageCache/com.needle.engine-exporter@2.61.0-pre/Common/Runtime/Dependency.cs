using System;
using System.IO;
using System.Text;
using Needle.Engine.Utils;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace Needle.Engine
{
	[Serializable]
	public struct Dependency
	{
		public string Name;

		public string VersionOrPath;

		// the guid is used to find the new path of a dependency
		public string Guid;

		public bool Install(string packageJsonPath)
		{
			if (string.IsNullOrEmpty(Name)) return false;
			if (IsMissingNpmDef())
			{
				Debug.LogWarning("Can not install dependency \"" + Name + "\" because npmdef was not found in project at \"" + VersionOrPath + "\"");
				return false;
			}
			if (TryGetVersionOrPath(out var versionOrPath))
			{
				if (!Path.IsPathRooted(packageJsonPath)) packageJsonPath = Path.GetFullPath(packageJsonPath);
				if (!PackageUtils.TryReadDependencies(packageJsonPath, out var deps)) return false;
				versionOrPath = Path.GetFullPath(versionOrPath);
				versionOrPath = versionOrPath.RelativeTo(packageJsonPath);
				if (File.Exists(versionOrPath) && !versionOrPath.StartsWith("file:")) 
					versionOrPath = "file:" + versionOrPath;
				if (!deps.ContainsKey(Name)) deps.Add(Name, versionOrPath);
				else deps[Name] = versionOrPath;
				PackageUtils.TryWriteDependencies(packageJsonPath, deps);
				return true;
			}
			return false;
		}

		public bool IsMissingNpmDef()
		{
			ResolvePath();
			var versionOrPath = VersionOrPath;
			if (string.IsNullOrEmpty(versionOrPath)) return false;
			if (versionOrPath.EndsWith(".npmdef"))
			{
				if (!File.Exists(versionOrPath))
				{
					return true;
				}
			}
			return false;
		}

		public bool TryGetVersionOrPath(out string path, bool ignoreMissing = false)
		{
			path = null;
			ResolvePath();
			// we want to install the path to the hidden package dir
			var versionOrPath = VersionOrPath;
			if (string.IsNullOrEmpty(versionOrPath)) return false;
			if (versionOrPath.EndsWith(".npmdef"))
			{
				if (!ignoreMissing && !File.Exists(versionOrPath))
				{
					return false;
				}
				versionOrPath = versionOrPath.Substring(0, versionOrPath.Length - ".npmdef".Length) + "~";
			}
			path = versionOrPath;
			return !string.IsNullOrWhiteSpace(path);
		}

		private void ResolvePath()
		{
#if UNITY_EDITOR
			if (!string.IsNullOrEmpty(Guid))
			{
				var fromGuid = AssetDatabase.GUIDToAssetPath(Guid);
				if (!string.IsNullOrEmpty(fromGuid))
					VersionOrPath = fromGuid;
			}
#endif
		}
	}
}