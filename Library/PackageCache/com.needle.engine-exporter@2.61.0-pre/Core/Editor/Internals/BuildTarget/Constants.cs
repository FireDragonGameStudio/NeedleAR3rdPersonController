using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using System.Reflection;
using UnityEditor.Build;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public static class BuildPlatformConstants
	{
		// Keep in sync with Common.Constants
		
#if UNITY_2021_1_OR_NEWER
		public const string TargetName = "EmbeddedLinux";
		public const string JamTarget = "EmbeddedLinuxEditorExtension";
		public const BuildTargetGroup BuildTargetGroup = UnityEditor.BuildTargetGroup.EmbeddedLinux;
		public const BuildTarget BuildTarget = UnityEditor.BuildTarget.EmbeddedLinux;
#else
		public const string TargetName = "Lumin";
		public const string JamTarget = "LuminEditorExtension";
		public const BuildTargetGroup BuildTargetGroup = UnityEditor.BuildTargetGroup.Lumin;
		public const BuildTarget BuildTarget = UnityEditor.BuildTarget.Lumin;
#endif
		
		public const float LeftColumnWidth = 110;

		internal const string Title = "Needle Engine";
		internal const string IconPath = "Packages/com.needle.engine-exporter/Core/Editor/Internals/BuildTarget/Assets";
		internal const string BigIconPath = IconPath + "/icon.png";
		internal const string SmallIconPath = IconPath + "/icon-small.png";
		internal const string EmptyIconPath = IconPath + "/empty.png";


		private static BuildPlatform _platform;
		internal static BuildPlatform Platform
		{
			get
			{
				if (_platform != null) return _platform;
				
#if UNITY_2021_1_OR_NEWER
				var platform = new BuildPlatform(Title, 
					BigIconPath, 
					NamedBuildTarget.FromBuildTargetGroup(BuildTargetGroup), 
					BuildTarget, 
					false);
#else
				var platform = new BuildPlatform(Title, 
					BigIconPath, 
					BuildTargetGroup, 
					BuildTarget, 
					true);
#endif

				platform.GetType().GetField("m_SmallTitle", (BindingFlags)(-1))?.SetValue(platform,
					new ScalableGUIContent((string)null, (string)null, SmallIconPath));
				_platform = platform;
				return _platform;
			}
		}

		private static string _buildPlatformExtensionDirectory;
		internal static string BuildPlatformExtensionDirectory {
			get
			{
				if(_buildPlatformExtensionDirectory != null) return _buildPlatformExtensionDirectory;
				_buildPlatformExtensionDirectory = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "/Needle/Needle Engine Unity Platform Support";
				if(!Directory.Exists(_buildPlatformExtensionDirectory)) Directory.CreateDirectory(_buildPlatformExtensionDirectory);
				return _buildPlatformExtensionDirectory;
			}
		}
		
		
		private static BuildPlatform _none;
		internal static BuildPlatform None
		{
			get
			{
				if (_none != null) return _none;

#if UNITY_2021_1_OR_NEWER
				var platform = new BuildPlatform("", 
					EmptyIconPath, 
					NamedBuildTarget.FromBuildTargetGroup(BuildTargetGroup.Unknown), 
					BuildTarget.NoTarget, 
					true);
#else
				var platform = new BuildPlatform("", 
					EmptyIconPath, 
					BuildTargetGroup.Unknown, 
					BuildTarget.NoTarget,
					true);
#endif

				platform.GetType().GetField("m_SmallTitle", (BindingFlags)(-1))?.SetValue(platform,
					new ScalableGUIContent((string)null, (string)null, EmptyIconPath));
				_none = platform;
				return _none;
			}
		}
	}
}