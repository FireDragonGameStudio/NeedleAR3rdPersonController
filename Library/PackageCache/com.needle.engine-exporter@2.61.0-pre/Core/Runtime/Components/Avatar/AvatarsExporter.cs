// using System.IO;
// using System.Linq;
// using Needle.Engine.Utils;
// using UnityEngine;
// using Debug = UnityEngine.Debug;
// using Object = UnityEngine.Object;
//
// #if UNITY_EDITOR
// using Needle.Engine.Core;
// using UnityEditor;
// #endif
//
// namespace Needle.Engine.Components
// {
// #if UNITY_EDITOR
// 	public class AvatarsExporter
// 	{
// 		// TODO menu items to only export interactive glb
//
// 		// [MenuItem("Needle/Tiny/Export Interactive Avatar", true)]
// 		// private static bool ExportInteractiveGlb_Validate()
// 		// {
// 		// 	if(!Object)
// 		// }
//
// 		// [MenuItem("Needle/Tiny/Export Standalone Gltf", false, 20_000)]
// 		// public static void ExportNormal()
// 		// {
// 		// 	ExportInteractiveGlb(false);
// 		// }
// 		//
// 		// [MenuItem("Needle/Tiny/Export Standalone Gltf (Compressed)", false, 20_000)]
// 		// public static void ExportCompressed()
// 		// {
// 		// 	ExportInteractiveGlb(true);
// 		// }
// 		
// 		public static async void ExportInteractiveGlb(bool compressed)
// 		{
// 			var dir = Path.GetFullPath(Application.dataPath + "/../Export/StandaloneGltf");
// 			if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
// 			var avatars = Object.FindObjectsOfType<StandaloneGltfObject>();
// 			var sel = Selection.objects;
// 			var anyAvatarSelected = sel.Any(s =>
// 			{
// 				if (s is GameObject go && go.TryGetComponent<StandaloneGltfObject>(out _)) return true;
// 				return false;
// 			});
// 			
// 			var didExportAnyAvatar = false;
// 			foreach (var avt in avatars)
// 			{
// 				if (anyAvatarSelected && !Selection.Contains(avt.gameObject))
// 				{
// 					Debug.Log("<color=#888888>Skip " + avt.name + " because not selected (will export all in scene if none selected)</color>");
// 					continue;
// 				}
// 				var path = dir + "/" + avt.name + ".glb";
// 				if (File.Exists(path)) File.Delete(path);
// 				avt.Export(path, true, null);
// 				Debug.Log($"Exported {avt.name} to <a href=\"{path}\">{path}</a>", avt);
// 				didExportAnyAvatar = true;
// 			}
// 			
// 			if (didExportAnyAvatar)
// 			{
// 				if (compressed)
// 				{
// 					var info = Object.FindObjectOfType<ExportInfo>();
// 					var projectDir = Path.GetFullPath(Builder.BasePath + "/" + info.DirectoryName);
// 					if (Directory.Exists(projectDir))
// 					{
// 						Debug.Log("<b>Compress avatars</b>");
// 						var res = await ProcessHelper.RunCommand("npm run pack-gltf " + dir, projectDir, dir + "/log.txt");
// 						if (res)
// 						{
// 							Debug.Log($"<b>Compressing <color=#00dd00>succeeded</color></b>: <a href=\"{dir}\">{dir}</a>");
// 						}
// 						else
// 							Debug.LogError("Something went wrong compressing. Please check the logs");
// 					}
// 					else Debug.LogError("Could not compress avatars because project directory does not exist: " + projectDir);
// 				}
// 				
// 				Application.OpenURL(dir);
// 			}
// 			else Debug.LogError($"Nothing to export - Do you have any objects with {nameof(StandaloneGltfObject)} components on them in your scene?");
// 		}
// 	}
// #endif
// }