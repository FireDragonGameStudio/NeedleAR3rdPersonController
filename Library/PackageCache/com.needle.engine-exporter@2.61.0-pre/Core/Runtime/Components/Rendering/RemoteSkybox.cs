using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;

namespace Needle.Engine.Components
{
	public class RemoteSkybox : MonoBehaviour
	{
		public string url;
		[Info("Optional: when assigned this texture will be copied to the output directory")] 
		public ImageReference local;
		[Tooltip("When enabled exr and hdr textures can be dropped on your web page to replace the skybox")]
		public bool allowDrop = true;
		
		[Tooltip("When enabled the skybox will be displayed in the background")]
		public bool background = true;
		[Tooltip("When enabled the skybox will be used for environment lighting")]
		public bool environment = true;

		// ReSharper disable once Unity.RedundantEventFunction
		private void OnEnable()
		{
			// just for Unity
		}

#if UNITY_EDITOR
		private void OnValidate()
		{
			if (local?.Texture && !url.StartsWith("http"))
			{
				var path = AssetDatabase.GetAssetPath(local.Texture);
				if (!string.IsNullOrEmpty(path))
				{
					var name = new FileInfo(path);
					url = "/assets/" + name.Name;
				}
			}
		}
#endif
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(RemoteSkybox))]
	public class SkyboxEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			using (var change = new EditorGUI.ChangeCheckScope())
			{
				var skybox = this.target as RemoteSkybox;
				if (skybox)
				{
					if (string.IsNullOrWhiteSpace(skybox.url))
					{
						EditorGUILayout.HelpBox("Copy paste HDRi urls from PolyHaven.com. For example this \"https://polyhaven.com/a/brown_photostudio_02\"",
							MessageType.None);
					}
				}

				base.OnInspectorGUI();
				if (!skybox) return;
				
				if (change.changed)
				{
					// https://polyhaven.com/a/abandoned_waterworks
					// https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/abandoned_waterworks_1k.hdr
					// https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k/brown_photostudio_01_1k.exr
					var url = skybox.url;
					if (!string.IsNullOrEmpty(url) && !url.EndsWith(".hdr") && !url.EndsWith(".exr"))
					{
						if (url.StartsWith("https://polyhaven.com"))
						{
							var name = url.Substring(url.LastIndexOf('/'));
							skybox.url = "https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k" + name + "_1k.exr";
						}
					}
				}

				if (!string.IsNullOrEmpty(skybox.url))
				{
					if (skybox.url.StartsWith("http"))
					{
						EditorGUILayout.HelpBox(skybox.url, MessageType.Info);
					}
				}

				GUILayout.Space(3);
				if (GUILayout.Button("Open PolyHaven.com", GUILayout.Height(30)))
				{
					Application.OpenURL("https://polyhaven.com/hdris");
				}
			}
		}
	}
#endif
}