// #define UNITY_EDITOR_OSX

using System.Collections.Generic;
using UnityEngine;
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
using System.IO;
using System.Linq;
#endif

namespace Needle.Engine.Utils
{
	public static class NpmUtils
	{
		public const string NpmInstallFlags = "--install-links=false";
		public const string NpmNoProgressAuditFundArgs = "--progress=false --no-audit --no-fund";
		
		public static string GetInstallCommand()
		{
			return $"npm install {NpmInstallFlags} {NpmNoProgressAuditFundArgs}";
		}
		
		internal static string TryFindNvmInstallDirectory()
		{
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
			var path = default(string);
			var userDirectory = System.Environment.GetFolderPath(System.Environment.SpecialFolder.UserProfile);
			var npmDirectory = System.IO.Path.Combine(userDirectory, ".nvm/versions/node");
			if (Directory.Exists(npmDirectory))
			{
				var versions = System.IO.Directory.GetDirectories(npmDirectory);
				if (versions.Length > 0)
				{
					var latestVersion = versions.Last();
					path = System.IO.Path.Combine(latestVersion, "bin");
					if (!Directory.Exists(path)) path = null;

				}
			}
			return path;
#else
			return null;
#endif
		}

		public static void LogPaths()
		{
#if UNITY_EDITOR_WIN
			var npmPaths = new List<string>();
			foreach (var line in ProcessHelper.RunCommandEnumerable("echo %PATH%"))
			{
				var parts = line.Split(';');
				foreach (var part in parts)
				{
					if (part.Contains("npm") || part.Contains("nodejs"))
						npmPaths.Add(part);
				}
			}
			Debug.Log(string.Join("\n", npmPaths));
#endif
		}
	}
}