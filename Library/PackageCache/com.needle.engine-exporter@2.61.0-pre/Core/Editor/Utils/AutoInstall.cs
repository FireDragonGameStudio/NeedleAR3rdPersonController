using UnityEditor;
using UnityEditor.PackageManager;
using PackageInfo = UnityEditor.PackageManager.PackageInfo;

namespace Needle.Engine.Utils
{
	internal static class AutoInstall
	{
#if UNITY_2020_3_OR_NEWER
		[InitializeOnLoadMethod]
		private static void Init()
		{
			Events.registeredPackages -= OnPackageRegistered;
			Events.registeredPackages += OnPackageRegistered;
		}

		private static void OnPackageRegistered(PackageRegistrationEventArgs args)
		{
			foreach (var arg in args.added)
			{
				if (TryRunProjectSetup(arg)) return;
			}
			foreach (var arg in args.changedTo)
			{
				if (TryRunProjectSetup(arg)) return;
			}
			
			if(!Actions.LocalPackagesAreInstalled())
				RunAutoInstall();
		}

		private static bool TryRunProjectSetup(PackageInfo packageInfo)
		{
			switch (packageInfo.name)
			{
				case Constants.RuntimeUnityPackageName:
				case Constants.UnityPackageName:
					RunAutoInstall();
					return true;
			}
			return false;
		}

		private static async void RunAutoInstall()
		{
			Actions.StopLocalServer();
			await Actions.RunProjectSetup(Actions.PathType.LocalThreejs | Actions.PathType.NeedleRuntimePackage, true);
		}
#endif
	}
}