using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	/// <summary>
	/// Exports the fields in this component automatically to the typescript component of type T
	/// </summary>
	/// <typeparam name="T">The type to emit additional data to/for</typeparam>
	public abstract class AdditionalComponentData<T> : MonoBehaviour, IAdditionalComponentDataProvider where T : Component
	{
		private List<FieldInfo> additionalFields = null;

		public void OnSerialize(Component comp, List<(object key, object value)> additionalData)
		{
			if (comp is T)
			{
				if (additionalFields == null)
				{
					var fields = GetType()
						.GetFields(BindingFlags.Public | BindingFlags.Instance | BindingFlags.NonPublic)
						.Where(f => f.IsPublic || f.GetCustomAttribute<SerializeField>() != null);
					additionalFields = new List<FieldInfo>();
					additionalFields.AddRange(fields);
				}

				foreach (var field in additionalFields)
				{
					var value = field.GetValue(this);
					// TODO: apply same field name convention as with all fields in Needle Engine and make the first letter lowercase
					additionalData.Add((field.Name, value));
				}
			}
		}
	}

	internal static class TypeUtils
	{
		internal static bool TryFindGenericArgument(Type type, out Type arg)
		{
			arg = null;
			while (type != null)
			{
				arg = type.GetGenericArguments().FirstOrDefault();
				if (arg != null)
					break;
				type = type.BaseType;
			}
			return arg != null;
		}
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(AdditionalComponentData<>), true)]
	internal class AdditionalComponentDataEditor : Editor
	{
		private Type targetType = null;
		private bool isValid = false;

		private void OnEnable()
		{
			TypeUtils.TryFindGenericArgument(target.GetType(), out targetType);

			if (targetType != null)
			{
				var comp = target as Component;
				isValid = comp!.TryGetComponent(targetType, out _);
			}
		}

		public override void OnInspectorGUI()
		{
			if (!target) return;

			if (targetType != null && !isValid)
			{
				using (new EditorGUILayout.HorizontalScope())
				{
					EditorGUILayout.HelpBox("Missing " + targetType, MessageType.Warning);
					if (GUILayout.Button("Fix", GUILayout.Height(37)))
					{
						Undo.AddComponent((target as Component)!.gameObject, targetType);
					}
				}
				EditorGUILayout.Space(3);
			}
			
			base.OnInspectorGUI();
		}
	}
#endif
}