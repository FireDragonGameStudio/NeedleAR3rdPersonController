#nullable enable
using System.IO;
using UnityEngine;

namespace Needle.Engine
{
	public interface IProjectInfo
	{
		public string ProjectDirectory { get; }
		public string AssetsDirectory { get; }
		public string PackageJsonPath { get; }
		public bool Exists();
		public bool IsInstalled();
	}

	public static class ProjectInfoExtensions
	{
		public static string GetCacheDirectory()
		{
			return Path.GetFullPath(Application.dataPath + "/../Library/Needle/AssetCache");
		}
	}

	public struct DefaultProjectInfo : IProjectInfo
	{
		public DefaultProjectInfo(string projectDirectory, string? assetsDirectory = null, string? packageJsonPath = null)
		{
			ProjectDirectory = projectDirectory;
			AssetsDirectory = assetsDirectory ?? Path.Combine(projectDirectory, "Assets");
			PackageJsonPath = packageJsonPath ?? Path.Combine(projectDirectory, "package.json");
		}

		public string ProjectDirectory { get; }
		public string AssetsDirectory { get; }
		public string PackageJsonPath { get; }
		
		public bool Exists()
		{
			return File.Exists(PackageJsonPath);
		}

		public bool IsInstalled()
		{
			return Directory.Exists(ProjectDirectory + "/node_modules");
		}
	}
}