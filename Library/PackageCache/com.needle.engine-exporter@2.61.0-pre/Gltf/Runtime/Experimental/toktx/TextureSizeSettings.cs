using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Gltf.Experimental
{
	public class TextureSizeSettings : MonoBehaviour
	{
		public int MaxSize = 1024;
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(TextureSizeSettings))]
	public class TextureSizeSettingsEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			base.OnInspectorGUI();
			var obj = (TextureSizeSettings)target;
			if (Mathf.IsPowerOfTwo(obj.MaxSize) == false)
			{
				EditorGUILayout.HelpBox("MaxSize should be a power of two: 32, 64, 128, 256, 512, 1024, 2048, 4096 ...", MessageType.Warning);
				if (GUILayout.Button("Select closest Power of Two"))
				{
					Undo.RegisterCompleteObjectUndo(target, "Fix Power of two");
					obj.MaxSize = Mathf.ClosestPowerOfTwo(obj.MaxSize);
				}
			}
		}
	}
#endif
}