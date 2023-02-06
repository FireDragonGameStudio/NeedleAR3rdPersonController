using System.IO;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine
{
	internal static class ViteActions
	{
		public static bool DeleteCache(string projectDirectory)
		{
			if (string.IsNullOrWhiteSpace(projectDirectory)) return false;
			// we do this because we had issues with changing projects while vite was still running
			// causing wrong files showing up in the cache and subsequently showing up in both
			// local servers as well as built projects because of that
			// maybe this was / is also the reason for why sometimes vite reports errors when it tries to
			// import script files that dont exist in the current project
			var didDelete = false;
			var cacheDirectory = projectDirectory + "/node_modules/.vite";
			if (Directory.Exists(cacheDirectory))
			{
				didDelete = true;
				FileUtils.DeleteDirectoryRecursive(cacheDirectory);
			}
			
			var vitePackageInModules = projectDirectory + "/node_modules/vite";
			if (Directory.Exists(vitePackageInModules))
			{
				didDelete = true;
				FileUtils.DeleteDirectoryRecursive(vitePackageInModules);
			}
			
			// to delete the ssl plugin
			var viteOrgFolder = projectDirectory + "/node_modules/@vite";
			if (Directory.Exists(viteOrgFolder))
			{
				didDelete = true;
				FileUtils.DeleteDirectoryRecursive(viteOrgFolder);
			}
			
			return didDelete;
		}
	}
}