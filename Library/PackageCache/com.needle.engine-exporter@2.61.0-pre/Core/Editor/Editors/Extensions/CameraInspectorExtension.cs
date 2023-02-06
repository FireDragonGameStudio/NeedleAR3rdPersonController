using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Editors
{
	public class CameraInspectorExtension : ComponentEditorExtension
	{
		public override bool ShouldExtend(Object target)
		{
			return target is Camera;
		}

		public override void OnInspectorGUI(Object target)
		{
			if (target is Camera cam)
			{
				if (cam.backgroundColor.a == 0 && cam.clearFlags == CameraClearFlags.SolidColor)
				{
					using (new EditorGUILayout.HorizontalScope())
					{
						GUILayout.Space(5);
						EditorGUILayout.HelpBox("Camera Background is set to solid color but color alpha is zero! The color will not be visible in the WebGl scene. Increase the alpha value of set the BackgroundType to Uninitialized if this is intentional!", MessageType.Warning);
						GUILayout.Space(5);
					}
					GUILayout.Space(12);
				}
			}
		}
	}
}