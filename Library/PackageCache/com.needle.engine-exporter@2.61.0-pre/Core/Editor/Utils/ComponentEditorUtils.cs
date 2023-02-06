using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	internal static class ComponentEditorUtils
	{
		internal static bool DrawDefaultInspectorWithoutScriptField(SerializedObject obj, Func<string, bool> onDrawScriptProperty = null, GUILayoutOption[] options = null)
		{
			EditorGUI.BeginChangeCheck();
			obj.UpdateIfRequiredOrScript();
			SerializedProperty iterator = obj.GetIterator();
			for (bool enterChildren = true; iterator.NextVisible(enterChildren); enterChildren = false)
			{
				if ("m_Script" == iterator.propertyPath)
				{
					if (onDrawScriptProperty == null) continue;
					if (!onDrawScriptProperty.Invoke(iterator.propertyPath)) continue;
					using (new EditorGUI.DisabledScope("m_Script" == iterator.propertyPath))
						EditorGUILayout.PropertyField(iterator, true, options);
				}
				else
					EditorGUILayout.PropertyField(iterator, true, options);
			}
			obj.ApplyModifiedProperties();
			return EditorGUI.EndChangeCheck();
		}
	}
}