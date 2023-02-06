using System.IO;
using JetBrains.Annotations;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace Needle.Engine.Samples
{
	[CreateAssetMenu(menuName = "Needle Engine/Samples/Sample Info")]
	public class SampleInfo : ScriptableObject
	{
		[UsedImplicitly]
		public string Name
		{
			get => DisplayNameOrName;
			set => DisplayName = value;
		}
		
		[JsonIgnore]
		public string DisplayName;
		public string Description;
		public Texture2D Thumbnail;
		[JsonIgnore]
		public SceneAsset Scene;
		public string LiveUrl;
		[JsonIgnore]
		public string DisplayNameOrName => !string.IsNullOrWhiteSpace(DisplayName) ? DisplayName : ObjectNames.NicifyVariableName(name);

		[JsonIgnore][HideInInspector]
		public SampleInfo reference;
		
		private void OnValidate()
		{
			if (!Scene)
			{
				var path = AssetDatabase.GetAssetPath(this);
				if (string.IsNullOrWhiteSpace(path)) return;
				var scenes = AssetDatabase.FindAssets("t:SceneAsset", new[] { Path.GetDirectoryName(path) });
				foreach (var guid in scenes)
				{
					var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(AssetDatabase.GUIDToAssetPath(guid));
					Scene = scene;
					if (scene)
						break;
				}
			}
		}

#if UNITY_EDITOR
		[OnOpenAsset(100)]
		private static bool OpenAsset(int instanceID, int line)
		{ 
			if (EditorUtility.InstanceIDToObject(instanceID) is SampleInfo sampleInfo)
			{
				if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
					EditorSceneManager.OpenScene(AssetDatabase.GetAssetPath(sampleInfo.Scene));
				return true;
			}
        
			return false;
		}
#endif
	}
	    
#if UNITY_EDITOR
	[CustomEditor(typeof(SampleInfo), true)]
	class SampleInfoEditor : Editor
	{
		public override VisualElement CreateInspectorGUI()
		{
			var t = target as SampleInfo;
			if (!t) return new Label("<null>");

			var v = new VisualElement() { style = { maxHeight = 500 } };
			foreach (var style in SamplesWindow.StyleSheet)
				v.styleSheets.Add(style);

			if (!EditorGUIUtility.isProSkin) v.AddToClassList("__light");
			v.Add(new SamplesWindow.Sample(t));

			if (!AssetDatabase.IsSubAsset(t))
			{
				v.Add(new IMGUIContainer(() => DrawDefaultInspector()));
			}
			
			return v;
		}
	}
#endif
}