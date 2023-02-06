using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Editors
{
	[CustomPropertyDrawer(typeof(ImageReference))]
	public class ImageReferenceDrawer : PropertyDrawer
	{
		public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
		{
			EditorGUI.PropertyField(position, property.FindPropertyRelative(nameof(ImageReference.Texture)), label);
		}
	}
}