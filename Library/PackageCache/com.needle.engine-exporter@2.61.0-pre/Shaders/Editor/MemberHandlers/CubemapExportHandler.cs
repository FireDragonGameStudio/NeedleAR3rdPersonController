// using System.Diagnostics;
// using Needle.Engine;
// using Needle.Engine.Interfaces;
// using Needle.Engine.ResourceProvider;
// using Needle.Engine.Utils;
// using UnityEngine;
// using UnityEngine.Rendering;
// using Debug = UnityEngine.Debug;
//
// namespace Needle.Engine.Shader.MemberHandlers
// {
// 	public class CubemapExportHandler : IBuildStageCallbacks
// 	{
// 		private static readonly Stopwatch watch = new Stopwatch();
//
// 		// TODO: remove this path once we have the light extension
// 		
// 		public Task OnBuild(BuildStage stage, ExportContext context)
// 		{
// 			if (stage == BuildStage.PreBuildScene)
// 			{
// // 				watch.Reset();
// // 				watch.Start();
// //
// // 				var textureSize = 256;
// // 				var settings = ObjectUtils.FindObjectOfType<ISkyboxExportSettingsProvider>();
// // 				if (settings != null)
// // 				{
// // 					textureSize = settings.SkyboxResolution;
// // 				}
// //
// // 				using var exporter = new CubemapExporter(textureSize, OutputFormat.PNG);
// // 				var skybox = exporter.ConvertSkyboxMaterialToEquirectTexture(true);
// // 				if (skybox)
// // 				{
// // 					skybox.hideFlags = HideFlags.None;
// // 					skybox.name = "Skybox";
// // 					TextureResource.Add(skybox);
// // 				}
// //
// // 				// File.WriteAllBytes("Assets/ExportedSkybox.png", skybox.EncodeToPNG());
// //
// // 				if (RenderSettings.defaultReflectionMode == DefaultReflectionMode.Custom)
// // 				{
// // #if UNITY_2022_1_OR_NEWER
// // 					var custom = RenderSettings.customReflectionTexture as Cubemap;
// // #else
// // 					var custom = RenderSettings.customReflection as Cubemap;
// // #endif
// // 					if (custom)
// // 					{
// // 						var exp = new CubemapExporter(textureSize, OutputFormat.PNG);
// // 						var customReflection = exporter.ConvertCubemapToEquirectTexture(custom, true);
// // 						if (customReflection)
// // 						{
// // 							customReflection.hideFlags = HideFlags.None;
// // 							customReflection.name = "CustomReflection";
// // 							TextureResource.Add(customReflection);
// // 						}
// // 					}
// // 				}
//
// 				// if (skybox)
// 				// {
// 				// 	Debug.Log("TEMP, remove this once skybox loading via resources works");
// 				// 	var path = context.Project.AssetsDirectory + "/environment";
// 				// 	exporter.WriteTextureToDisk(skybox, path);
// 				// }
//
// 				// watch.Stop();
// 				// Debug.Log($"Exported skybox and environment in {watch.ElapsedMilliseconds:0} ms");
// 			}
// 		}
// 	}
// }