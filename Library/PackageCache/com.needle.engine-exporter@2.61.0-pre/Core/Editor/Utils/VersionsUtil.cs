using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Semver;
using UnityEditor.PackageManager;

namespace Needle.Engine.Utils
{
	internal static class VersionsUtil
	{
		public static bool HasRuntimePackageUpdate(out PackageInfo info)
		{
			return HasUpdate(Constants.RuntimeUnityPackageName, out info);
		}

		public static bool HasExporterPackageUpdate(out PackageInfo info)
		{
			return HasUpdate(Constants.UnityPackageName, out info);
		}

		public static void ClearCache()
		{
			availableUpdates.Clear();
		}

		private static bool HasUpdate(string packageName, out PackageInfo info)
		{
			if (availableUpdates.ContainsKey(packageName))
			{
				info = availableUpdates[packageName];
				return info != null;
			}
			DetectUpdateAvailable(packageName);
			info = default;
			return false;
		}

		private static readonly List<string> searching = new List<string>();
		private static readonly Dictionary<string, PackageInfo> availableUpdates = new Dictionary<string, PackageInfo>();

		private static async void DetectUpdateAvailable(string packageName)
		{
			if (searching.Contains(packageName)) return;
			searching.Add(packageName); 
			var request = Client.Search(packageName, false);
			while (request.IsCompleted == false) await Task.Yield();
			searching.Remove(packageName);
			if (availableUpdates.ContainsKey(packageName))
				availableUpdates[packageName] = default;
			
			
			var latest = request.Result?.LastOrDefault();
			if (!SemVersion.TryParse(latest?.version, SemVersionStyles.Any, out var latestVersion)) return;
			if (SemVersion.TryParse(ProjectInfo.GetCurrentPackageVersion(packageName, out _), SemVersionStyles.Any, out var installed))
			{
				if (installed < latestVersion)
				{
					availableUpdates.Add(packageName, latest); 
				}
			}
		}
	}
}