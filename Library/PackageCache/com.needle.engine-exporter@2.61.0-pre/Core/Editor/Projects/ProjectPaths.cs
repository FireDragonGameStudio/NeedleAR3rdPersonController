#nullable enable
using System.IO;
using Needle.Engine.Settings;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Projects
{
	internal static class ProjectPaths
	{
		public static string UnityProjectDirectory
		{
			get
			{
				projectDirectory ??= Path.GetFullPath(Application.dataPath + "/../");
				return projectDirectory;
			}
		}

		public static string? PackageDirectory
		{
			get
			{
				if (packagePath == null)
				{
					var package = AssetDatabase.GUIDToAssetPath("041e32dc0df5f4641b30907afb5926e6");
					if(!string.IsNullOrEmpty(package))
					{
						packagePath = Path.GetFullPath(package);
						if(!string.IsNullOrEmpty(packagePath))
							packageDirectory = Path.GetDirectoryName(packagePath);
					}
				}
				return packageDirectory;
			}
		}

		public static string? NpmPackageDirectory
		{
			get
			{
				var settings = ExporterProjectSettings.instance;
				if (settings && !string.IsNullOrWhiteSpace(settings.localRuntimePackage))
				{
					return npmPackageDirectory = settings.localRuntimePackage;
				}
				return null;
			}
		}

		public static string? LocalThreejsModule
		{
			get
			{
				var settings = ExporterProjectSettings.instance;
				if (settings && !string.IsNullOrWhiteSpace(settings.localThreejsPackage) && Directory.Exists(settings.localThreejsPackage))
				{
					return settings.localThreejsPackage;
				}
				// TODO: fallback to threejs release version
				return null;
			}
		}

		private static string? projectDirectory = null;
		private static string? packagePath = null;
		private static string? packageDirectory = null;
		private static string? npmPackageDirectory = null;
	}
}