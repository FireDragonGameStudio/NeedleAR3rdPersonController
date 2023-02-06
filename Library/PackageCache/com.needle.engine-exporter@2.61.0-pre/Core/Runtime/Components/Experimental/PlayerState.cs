using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class PlayerState : UnityEngine.MonoBehaviour
	{
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(PlayerState))]
	internal class PlayerStateEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			// base.OnInspectorGUI();
			EditorGUILayout.HelpBox("Used for " + nameof(PlayerSync) + " to mark automatically networked player instances. Add this to the root of the asset you assign to a " + nameof(PlayerSync) + " component. In the future this might be implicitly added and networked.", MessageType.None);
		}
	}
#endif
}