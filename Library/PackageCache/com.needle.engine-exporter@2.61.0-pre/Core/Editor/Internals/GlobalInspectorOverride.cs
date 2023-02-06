#if UNITY_EDITOR
using System;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.UIElements;
using UnityEngine;
using UnityEngine.UIElements;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public static class InspectorHook
	{
		public static event Action<Editor, VisualElement> Inject;
		
		[InitializeOnLoadMethod]
		private static void Init()
		{
			UpdateInspector();
			EditorApplication.hierarchyChanged += UpdateInspector;
			ActiveEditorTracker.editorTrackerRebuilt += OnEditorTrackerRebuilt;
			// while(EditorApplication.isUpdating || EditorApplication.isCompiling)
			// 	await Task.Delay(100);
			// // Selection.selectionChanged += OnSelectionChanged;
			// UpdateInspector();
		}

		private static void OnEditorTrackerRebuilt()
		{
			UpdateInspector(); 
		}

		private const string InjectionClassName = "__needle_threejs";
		
		private static void UpdateInspector()
		{
			if (Inject == null) return;
			var openEditors = ActiveEditorTracker.sharedTracker.activeEditors;
			foreach (var ed in openEditors) 
			{
				var inspectors = InspectorWindow.GetInspectors(); 
				foreach (var ins in inspectors)
				{
					ins.rootVisualElement.Query<EditorElement>().ForEach(editorElement =>
					{
						if (editorElement.editor != ed) return;
						if (editorElement.ClassListContains(InjectionClassName)) return;
						editorElement.AddToClassList(InjectionClassName);
						try
						{
							Inject?.Invoke(ed, editorElement);
							ed.Repaint();
						}
						catch (Exception e)
						{
							Debug.LogException(e);
						}
					});
				}
			}
		}
	}
}
#endif