// using GLTFast;
// using UnityEngine;
//
// namespace Needle.Engine.Export
// {
// 	public class GltfObjectRemote : GltfAsset, IExportableObject
// 	{
// 		public void Export(string path)
// 		{
// 			// GltfObject.ExportWithGltfFast(this, gameObject, path, true);
// 			ExportUtils.ExportWithUnityGltf(transform, path);
// 		}
//
// 		protected override void Start()
// 		{
// 			if(Application.isPlaying) base.Start();
// 		}
// 		
// 		private async void OnEnable()
// 		{
// 			if (!Application.isPlaying && loadOnStartup)
// 			{
// 				await Load(FullUrl);
// 				foreach (Transform child in transform)
// 				{
// 					child.gameObject.hideFlags = HideFlags.DontSave;
// 				}
// 			}
// 		}
//
// 		private void OnDisable()
// 		{
// 			if (!Application.isPlaying)
// 			{
// 				foreach (Transform child in transform) {
// 					DestroyImmediate(child.gameObject);
// 				}
// 				sceneInstance = null;
// 			}
// 		}
// 	}
// }