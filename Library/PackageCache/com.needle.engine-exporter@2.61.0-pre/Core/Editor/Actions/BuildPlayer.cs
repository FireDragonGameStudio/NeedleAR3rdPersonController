// using Needle.Engine.Core;
// using Needle.Engine.Settings;
// using Needle.Engine.Utils;
// using UnityEditor;
//
// namespace Needle.Engine
// {
// 	internal static class BuildPlayer
// 	{
// 		[InitializeOnLoadMethod]
// 		private static void Init()
// 		{
// 			// BuildPlayerWindow.RegisterGetBuildPlayerOptionsHandler(OnGetBuildOptions);
// 			BuildPlayerWindow.RegisterBuildPlayerHandler(OnBuild);
// 		}
//
// 		// private static BuildPlayerOptions OnGetBuildOptions(BuildPlayerOptions opts)
// 		// {
// 		// 	if (MenuItems.IsValidExportScene(out var path))
// 		// 	{
// 		// 		// Debug.Log("Path: " + path);
// 		// 		// opts.target = BuildTarget.WebGL;
// 		// 		opts.locationPathName = path;
// 		// 		return opts;
// 		// 	}
// 		//
// 		// 	return BuildPlayerWindow.DefaultBuildMethods.GetBuildPlayerOptions(opts);
// 		// }
//
// 		private static void OnBuild(BuildPlayerOptions o)
// 		{
// 			// if (ExporterProjectSettings.instance.overrideBuildSettings == false)
// 			// {
// 				BuildPipeline.BuildPlayer(o);
// 			// 	return;
// 			// }
// 			// if (SceneExportUtils.IsValidExportScene(out _, out _))
// 			// {
// 			// 	if (o.options.HasFlag(BuildOptions.AutoRunPlayer) && o.options.HasFlag(BuildOptions.StrictMode))
// 			// 	{
// 			// 		MenuItems.BuildNowMenuItem();
// 			// 		MenuItems.StartDevelopmentServer();
// 			// 	}
// 			// 	else
// 			// 	{
// 			// 		var dev = o.options.HasFlag(BuildOptions.Development);
// 			// 		MenuItems.BuildForDist(dev ? BuildContext.Development : BuildContext.Production);
// 			// 	}
// 			// }
// 			// else
// 			// 	BuildPipeline.BuildPlayer(o);
// 		}
//
// 		
// 	}
// }