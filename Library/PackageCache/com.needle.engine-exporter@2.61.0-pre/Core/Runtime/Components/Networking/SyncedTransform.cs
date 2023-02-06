using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class SyncedTransform : MonoBehaviour
	{
		[Tooltip("Send transform updates more frequently")]
		public bool fastMode = false;

		public void requestOwnership()
		{
		}
	}
#if UNITY_EDITOR
	[CustomEditor(typeof(SyncedTransform))]
	internal class SyncedTransformEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			EditorGUILayout.HelpBox("Used to sync transform data across connected clients. Requires ownership to be requested.", MessageType.None);
			base.OnInspectorGUI();
		}
	}
#endif
}