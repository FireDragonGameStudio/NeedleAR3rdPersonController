using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class AxesHelper : MonoBehaviour
	{
		public float Length = 1;
		public bool DepthTest = true;
		[Tooltip("If enabled it requires ?gizmo url parameter to show")]
		public bool IsGizmo = false;

		private void OnDrawGizmos()
		{
			Gizmos.matrix = transform.localToWorldMatrix;
			Gizmos.color = Color.red;
			Gizmos.DrawLine(Vector3.zero, Vector3.right * -Length);
			Gizmos.color = Color.green;
			Gizmos.DrawLine(Vector3.zero, Vector3.up * Length);
			Gizmos.color = Color.blue;
			Gizmos.DrawLine(Vector3.zero, Vector3.forward * Length);
		}

		private void OnEnable()
		{
			
		}
	}
	
	#if UNITY_EDITOR
	[CustomEditor(typeof(AxesHelper))]
	internal class AxesHelperEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			EditorGUILayout.HelpBox("Shows threejs axis in editor (flipped x) and in browser", MessageType.None);
			base.OnInspectorGUI();
		}
	}
	#endif
}