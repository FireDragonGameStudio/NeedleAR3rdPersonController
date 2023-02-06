using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Gltf.Experimental.progressive
{
	[ExecuteAlways]
	[HelpURL(Constants.DocumentationUrl)]
	public class ProgressiveTexturesSettings : MonoBehaviour
	{
		public bool AllowProgressiveLoading = true;
		public bool UseMaxSize = true;
		
		[Tooltip("This is the max resolution for textures in the glb that is loaded at start - high-res textures with the original resolution will be loaded on demand.")]
		public int MaxSize = 128;

		// ReSharper disable once Unity.RedundantEventFunction
		private void OnEnable()
		{
			
		}
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(ProgressiveTexturesSettings))]
	public class UseProgressiveTexturesEditor : Editor
	{
		private SerializedProperty allowProgressiveLoading, useMaxSize, maxSize;
		
		private void OnEnable()
		{
			allowProgressiveLoading = serializedObject.FindProperty(nameof(ProgressiveTexturesSettings.AllowProgressiveLoading));
			useMaxSize = serializedObject.FindProperty(nameof(ProgressiveTexturesSettings.UseMaxSize));
			maxSize = serializedObject.FindProperty(nameof(ProgressiveTexturesSettings.MaxSize));
		}

		public override void OnInspectorGUI()
		{
			// ReSharper disable once LocalVariableHidesMember
			var target = (ProgressiveTexturesSettings) this.target;
			var change = new EditorGUI.ChangeCheckScope();
			EditorGUILayout.PropertyField(allowProgressiveLoading, new GUIContent("Allow Progressive", "When disabled no progressive loading is used (even if it's enabled in the TextureImporter settings)"));
			using (new EditorGUI.DisabledScope(target.AllowProgressiveLoading == false))
			{
				using (new GUILayout.HorizontalScope())
				{
					EditorGUILayout.PropertyField(useMaxSize, new GUIContent("Max Size"));
					using (new EditorGUI.DisabledScope(target.UseMaxSize == false))
					{
						EditorGUILayout.PropertyField(maxSize, new GUIContent());
					}
				}
			}
			if(change.changed) serializedObject.ApplyModifiedProperties();
			
			GUILayout.Space(5);
			EditorGUILayout.HelpBox("Tip: You can append '?debugprogressive' to add a random delay to the progressive loading. Textures can also be toggled between highres and lowres using P in that mode.", MessageType.None);
		}
	}
#endif
}
