#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.ProjectBundle
{
	[CustomEditor(typeof(Typescript))]
	internal class TypescriptSubAssetEditor : Editor
	{
		private string relativePath;
		private string fileContent;
		private readonly List<Object> components = new List<Object>();
		[NonSerialized] private GUIStyle scriptTextStyle;

		private void OnEnable()
		{
			var t = target as Typescript;
			if (!t) return;
			relativePath = PathUtils.MakeRelative(Path.GetFullPath(t.NpmDefPath), t.Path, false);
			if (File.Exists(t.Path))
				fileContent = File.ReadAllText(t.Path);
			t.FindComponent(components);
		}

		protected override void OnHeaderGUI()
		{
			base.OnHeaderGUI();
			var t = target as Typescript;
			if (!t) return;
			var rect = new Rect();
			const int buttonWidth = 44;
			rect.width = buttonWidth;
			rect.x = (Screen.width - rect.width) - 20;
			rect.y = 26;
			rect.height = 18;

			if (GUI.Button(rect, "Open"))
			{
				EditorUtility.OpenWithDefaultApp(t.Path);
			}
		}

		public override void OnInspectorGUI()
		{
			var t = target as Typescript;
			if (!t) return;
			// GUI.enabled = true;
			// base.OnInspectorGUI();
			if (components.Count > 0)
			{
				using (new EditorGUI.DisabledScope(true))
				{
					foreach (var component in components)
						EditorGUILayout.ObjectField(new GUIContent("Unity Component"), component, component.GetType(), false);
				}
			}
			else
			{
				EditorGUILayout.LabelField("Unity Component", "No component found");
			}

			var enabledTemp = GUI.enabled;
			GUI.enabled = true;

			GUILayout.Space(10);
			EditorGUILayout.LabelField("Typescript Information", EditorStyles.boldLabel);
			EditorGUILayout.LabelField("Typename", t.TypeName);
			EditorGUILayout.LabelField("Filepath", relativePath);
			GUILayout.Space(2);
			if (!string.IsNullOrEmpty(fileContent))
			{
				scriptTextStyle ??= new GUIStyle("ScriptText");

				var content = new GUIContent(fileContent);
				var rect = GUILayoutUtility.GetRect(content, scriptTextStyle);
				rect.x = 0;
				rect.width = Screen.width;
				GUI.Box(rect, content, scriptTextStyle);
			}
			GUI.enabled = enabledTemp;

			// if (Event.current.keyCode == KeyCode.Delete)
			// {
			// 	Debug.Log("TODO: delete ts");
			// }
		}
	}
}

#endif