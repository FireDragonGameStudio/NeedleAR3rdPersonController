// #define SHOW_ADDITIONAL_DATA_PREVIEW

using System;
using System.Collections.Generic;
using Needle.Engine.Hierarchy;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace Needle.Engine.Editors
{
	internal static class AdditionalComponentDataInspectorHint
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			var types = TypeCache.GetTypesDerivedFrom<IAdditionalComponentDataProvider>();
			foreach (var type in types)
			{
				if (type.IsInterface || type.IsAbstract) continue;
				if (!TypeUtils.TryFindGenericArgument(type, out var target)) continue;
				if (!optionsCache.ContainsKey(target)) optionsCache.Add(target, new List<Type>());
				optionsCache[target].Add(type);
			}
			InspectorHook.Inject += OnInject;
			HierarchyWatcher.ComponentAdded += OnComponentChanged;
			HierarchyWatcher.ComponentRemoved += OnComponentChanged;
		}

		private static void OnComponentChanged(Component obj)
		{
			// if multiple are selected dont do anything
			if (Selection.objects.Length == 1)
			{
				// hack to update injection
				var sel = Selection.activeObject;
				Selection.activeObject = null;
				Selection.activeObject = sel;
			}
		}

		private static readonly Dictionary<Type, List<Type>> optionsCache = new Dictionary<Type, List<Type>>();
		private static readonly Dictionary<Type, AdditionalDataDrawer> containers = new Dictionary<Type, AdditionalDataDrawer>();

		private static void OnInject(Editor editor, VisualElement element)
		{
			var target = editor.target;
			if (optionsCache.TryGetValue(target.GetType(), out var list))
			{
				foreach (var el in list)
				{
					if (!containers.TryGetValue(el, out var cont))
					{
						cont = new AdditionalDataDrawer(el);
						containers.Add(el, cont);
					}
					if (cont.SetTarget(target))
						element.Add(cont);
				}
			}
		}

		private class AdditionalDataDrawer : IMGUIContainer
		{
			private readonly Type type;
			private Object target;

			internal bool SetTarget(Object t)
			{
				this.target = t;
				if (target is Component comp && type != null)
				{
					return !comp.TryGetComponent(type, out _);
				}
				return false;
			}

			public AdditionalDataDrawer(Type type)
			{
				this.type = type;
				this.onGUIHandler += OnDraw;
			}

#if SHOW_ADDITIONAL_DATA_PREVIEW
			private static GameObject cacheGo; 
			private static readonly Dictionary<Type, Object> mockObjects = new Dictionary<Type, Object>();
			private static readonly Dictionary<Type, Editor> cachedPreviewEditor = new Dictionary<Type, Editor>();
#endif
			
			private void OnDraw()
			{
				if (!target) return;
				using (new EditorGUILayout.HorizontalScope())
				{
					GUILayout.Space(18);
					if (GUILayout.Button("Add " + type.Name))
					{
						if (target is Component comp)
						{
							target = null;
							Undo.AddComponent(comp.gameObject, type);
						}
					}
					GUILayout.Space(5);
				}
				GUILayout.Space(5);
				
#if SHOW_ADDITIONAL_DATA_PREVIEW
				// show preview of what additional data can be used / specified
				if (!mockObjects.TryGetValue(type, out var val) || !val)
				{
					if (!cacheGo)
					{
						cacheGo = new GameObject("ComponentCache");
						cacheGo.hideFlags = HideFlags.HideAndDontSave;
						cacheGo.SetActive(false);
					}

					mockObjects[type] = cacheGo.AddComponent(type);
					var requiredComponents = type.GetCustomAttributes(typeof(RequireComponent), true);
					foreach (RequireComponent required in requiredComponents)
					{
						if (required.m_Type0 != null) mockObjects[required.m_Type0] = cacheGo.AddComponent(required.m_Type0);
						if (required.m_Type1 != null) mockObjects[required.m_Type1] = cacheGo.AddComponent(required.m_Type1);
						if (required.m_Type2 != null) mockObjects[required.m_Type2] = cacheGo.AddComponent(required.m_Type2);
					}
				}
					
				EditorGUI.BeginDisabledGroup(true);
				EditorGUILayout.BeginVertical();
				cachedPreviewEditor.TryGetValue(type, out var editor);
				Editor.CreateCachedEditor(mockObjects[type], null, ref editor);
				cachedPreviewEditor[type] = editor;
				// TODO doesn't fully match how the editor will look when added
				var l = EditorGUIUtility.labelWidth;
				var f = EditorGUIUtility.fieldWidth;
				var h = EditorGUIUtility.hierarchyMode;
				EditorGUIUtility.labelWidth = 0f;
				EditorGUIUtility.fieldWidth = 0f;
				EditorGUIUtility.hierarchyMode = true;
				editor.OnInspectorGUI();
				EditorGUIUtility.labelWidth = l;
				EditorGUIUtility.fieldWidth = f;
				EditorGUIUtility.hierarchyMode = h;	
				EditorGUILayout.EndVertical();
				EditorGUI.EndDisabledGroup();
					
				GUILayout.Space(4);
				GUILayout.Space(4);
#endif
			}
		}
	}
}