using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using JetBrains.Annotations;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Modules;
using UnityEditor.VersionControl;
using UnityEngine;
using Debug = UnityEngine.Debug;
using Task = System.Threading.Tasks.Task;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	internal class BuildPostProcessor : IBuildPostprocessor
	{
		public void LaunchPlayer(BuildLaunchPlayerArgs args)
		{
		}

		public void PostProcess(BuildPostProcessArgs args, out BuildProperties outProperties)
		{
			outProperties = ScriptableObject.CreateInstance<DefaultBuildProperties>();
		}

		public bool SupportsInstallInBuildFolder() => false;
		public bool SupportsLz4Compression() => false;
		public Compression GetDefaultCompression() => Compression.None;
		public bool SupportsScriptsOnlyBuild() => false;

		public string PrepareForBuild(BuildOptions options, BuildTarget target) => null;


		public void UpdateBootConfig(BuildTarget target, BootConfigData config, BuildOptions options)
		{
		}

		public string GetExtension(BuildTarget target, BuildOptions options) => "html";

#if UNITY_2021_1_OR_NEWER
		public bool UsesBeeBuild()
		{
			return false;
		}

		public void PostProcessCompletedBuild(BuildPostProcessArgs args)
		{
			PostProcess(args, out _);
		}

		public string GetExtension(BuildTarget target, int subtarget, BuildOptions options)
		{
			return GetExtension(target, options);
		}
#endif
	}

	[UsedImplicitly]
	internal class TargetExtension : DefaultPlatformSupportModule
	{
		[InitializeOnLoadMethod, MenuItem("Needle Engine/Internal/Install Build Target")]
		private static async void Install()
		{
			InternalInstall();
			// hack/test because sometimes the build target seems to be not recognized for embedded assets or textures. not sure if this fixes it (e.g. the option is not available in the tabs)
			await Task.Delay(1000);
			InternalInstall();
		}

		private static void InternalInstall()
		{
			BuildPipeline.SetPlaybackEngineDirectory(BuildPlatformConstants.BuildTargetGroup, BuildPlatformConstants.BuildTarget,  (BuildOptions)~1, BuildPlatformConstants.BuildPlatformExtensionDirectory);
		}
		
		private static NeedleBuildWindowExtension s_BuildWindow; 
		private NeedleSettingsEditorExtension m_SettingsEditor;

		public override IBuildPostprocessor CreateBuildPostprocessor() => new BuildPostProcessor();
		public override string TargetName => BuildPlatformConstants.TargetName; 
		public override string JamTarget => BuildPlatformConstants.JamTarget; 

		public override void OnLoad()
		{
#if UNITY_2021_1_OR_NEWER
			Install();
			var name = NamedBuildTarget.FromBuildTargetGroup(BuildPlatformConstants.BuildTargetGroup);
			PlayerSettings.platformIconProviders.Remove(name.TargetName);
			PlayerSettings.RegisterPlatformIconProvider(name, new NeedlePlatformIconProvider());
			 
#else
			Install();
			PlayerSettings.platformIconProviders.Remove(BuildPlatformConstants.BuildTargetGroup);
			PlayerSettings.RegisterPlatformIconProvider(BuildPlatformConstants.BuildTargetGroup, new NeedlePlatformIconProvider());
#endif
		}

		public override void OnUnload()
		{ 
		}

		public override ISettingEditorExtension CreateSettingsEditorExtension() => m_SettingsEditor ??= new NeedleSettingsEditorExtension();
		public override IBuildWindowExtension CreateBuildWindowExtension() => s_BuildWindow ??= new NeedleBuildWindowExtension();

		public override ITextureImportSettingsExtension CreateTextureImportSettingsExtension()
		{
			return new NeedleEngineTextureImportSettings();
		}
	}

	internal class NeedleSettingsEditorExtension : DefaultPlayerSettingsEditorExtension
	{
		public override bool HasPublishSection() => true;
		public override bool CanShowUnitySplashScreen() => false;
		public override bool HasResolutionSection() => true;
		public override bool SupportsCustomLightmapEncoding() => true;

		public override void ResolutionSectionGUI(float h, float midWidth, float maxWidth)
		{
			// some settings depend on chosen base platform and can't be hidden:
			// PlayerSettingsEditor.PlatformGroupHasFlag
			// if (BuildTargetDiscovery.PlatformGroupHasFlag(targetGroup, BuildTargetDiscovery.TargetAttributes.HasIntegratedGPU))
			// return;
		}
	}

	internal class NeedleBuildWindowExtension : DefaultBuildWindowExtension
	{
		private static readonly NeedleEngineBuildOptions buildOptions = new NeedleEngineBuildOptions();
		private static INeedleBuildPlatformGUIProvider[] buildOptionProviders;
		private static INeedleBuildPlatformFooterGUIProvider[] footerProviders;

		private void OnDrawBuildOptions()
		{
			buildOptionProviders ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<INeedleBuildPlatformGUIProvider>().ToArray();

			const int toggleOffset = 47;
			using (new EditorGUILayout.HorizontalScope())
			{
				var tooltip = NeedleEngineBuildOptions.DevelopmentBuild
					? "Development build enabled - this means your project will produce bigger files because textures and meshes will not be compressed. Press this button to enable Production builds and compress your glTF files after building."
					: "Production build enabled - when building your resulting glTF files will get compressed using toktx (this means mainly meshes and textures will get way smaller)";
				EditorGUILayout.LabelField(new GUIContent("Development Build", tooltip), GUILayout.Width(BuildPlatformConstants.LeftColumnWidth));
				GUILayout.Space(toggleOffset);
				NeedleEngineBuildOptions.DevelopmentBuild = EditorGUILayout.Toggle(NeedleEngineBuildOptions.DevelopmentBuild);
			}
			using (new EditorGUILayout.HorizontalScope())
			{
				var tooltip = "When enabled html, css and js files will be gzip compressed during the build process. Please note that your server needs to support gzip compression to make use of this feature. Usually you can enable this using a .htaccess file.";
				EditorGUILayout.LabelField(new GUIContent("Gzip Compression", tooltip), GUILayout.Width(BuildPlatformConstants.LeftColumnWidth));
				GUILayout.Space(toggleOffset);
				NeedleEngineBuildOptions.UseGzipCompression = EditorGUILayout.Toggle(NeedleEngineBuildOptions.UseGzipCompression);
			}
			EditorGUILayout.Space(14);

			foreach (var prov in buildOptionProviders)
			{
				try
				{
					prov.OnGUI(buildOptions);
				}
				catch (ExitGUIException)
				{
					throw;
				}
				catch (Exception e)
				{
					Debug.LogException(e);
				}
			}
		}

		private void OnDrawBuildOptionsBottom()
		{
			using (new EditorGUILayout.HorizontalScope())
			{
				GUILayout.FlexibleSpace();
				footerProviders ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<INeedleBuildPlatformFooterGUIProvider>().ToArray();
				foreach (var prov in footerProviders)
				{
					try
					{
						prov.OnGUI(buildOptions);
					}
					catch (ExitGUIException)
					{
						throw;
					}
					catch (Exception e)
					{
						Debug.LogException(e);
					}
				}
			}
		}

		private void OnGUI()
		{
			// remainder of BuildPlayerWindow.ShowBuildTargetSettings
			OnDrawBuildOptions();
			GUILayout.EndScrollView();
			GUILayout.FlexibleSpace();
			GUILayout.BeginHorizontal();
			GUILayout.FlexibleSpace();
			GUILayout.EndHorizontal();
			GUILayout.Space(6f);
			GUILayout.BeginHorizontal();
			GUILayout.FlexibleSpace();
			GUILayout.EndHorizontal();
			OnDrawBuildOptionsBottom();
			// remainder of BuildPlayerWindow.OnGUI()
			GUILayout.EndVertical();
			GUILayout.EndHorizontal();
			GUILayout.Space(10f);
			GUILayout.EndVertical();
			GUILayout.Space(10f);
			GUILayout.EndHorizontal();

			// early out
			GUIUtility.ExitGUI();
		}

		public override void ShowPlatformBuildOptions()
		{
			OnGUI();
		}

		public override void GetBuildButtonTitles(out GUIContent buildButtonTitle, out GUIContent buildAndRunButtonTitle)
		{
			buildButtonTitle = new GUIContent("Build");
			buildAndRunButtonTitle = new GUIContent("Run in Browser");

			// called methods:
			// BuildPlayerWindow.CallBuildMethods(askForBuildLocation, BuildOptions.ShowBuiltPlayer);
			// BuildPlayerWindow.BuildPlayerAndRun(askForBuildLocation);
		}

		public override bool AskForBuildLocation() => false;
		public override bool ShouldDrawScriptDebuggingCheckbox() => false;
		public override bool ShouldDrawProfilerCheckbox() => false;

	}

	internal class NeedlePlatformIconProvider : IPlatformIconProvider
	{
		public Dictionary<PlatformIconKind, PlatformIcon[]> GetRequiredPlatformIcons()
		{
			var dict = new Dictionary<PlatformIconKind, PlatformIcon[]>();
			dict.Add(PlatformIconKind.Any, new[]
			{
				new PlatformIcon(128, 128, 1, 1, "", "xhdpi", PlatformIconKind.Any, draggable: true)
			});
			return dict;
		}

		public PlatformIconKind GetPlatformIconKindFromEnumValue(IconKind kind)
		{
			return PlatformIconKind.Any;
		}
	}
}