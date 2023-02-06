// using System;
// using System.IO;
// using UnityEditor.Experimental;
// using UnityEngine;
// using UnityEngine.SceneManagement;
//
// namespace Needle.Engine.Export
// {
// 	public class SceneChangeListener : AssetsModifiedProcessor
// 	{
// 		protected override void OnAssetsModified(string[] changedAssets, string[] addedAssets, string[] deletedAssets, AssetMoveInfo[] movedAssets)
// 		{
// 			foreach (var asset in changedAssets)
// 			{
// 				if (asset.EndsWith(".unity"))
// 				{
// 					var scene = SceneManager.GetActiveScene();
// 					if (scene.path == asset)
// 					{
// 						Debug.Log(scene.path + "\n" + asset);
// 						Debug.Log("Readback change");
// 						if (CurrentSceneChanged != null)
// 						{
// 							var text = File.ReadAllText(scene.path);
// 							CurrentSceneChanged?.Invoke(scene, text);
// 						}
// 					}
// 				}
// 			}
// 		}
//
// 		public static Action<Scene, string> CurrentSceneChanged;
// 	}
// }