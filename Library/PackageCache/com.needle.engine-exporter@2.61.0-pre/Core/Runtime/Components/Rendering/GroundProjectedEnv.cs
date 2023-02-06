using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	public class GroundProjectedEnv : MonoBehaviour
	{
		public bool applyOnAwake = true;
		public float scale = 100;
		public float radius = 100;
		public float height = 10;
	}
	
	#if UNITY_EDITOR
	[CustomEditor(typeof(GroundProjectedEnv))]
	public class GroundProjectedEnvEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			base.OnInspectorGUI();
			var proj = target as GroundProjectedEnv;
			if (!proj) return;
			var main = Camera.main;
			if (main)
			{
				if (proj.radius >= main.farClipPlane)
				{
					EditorGUILayout.HelpBox($"Projection radius is larger than main camera far plane. Projection might not be visible at runtime.\nConsider either increasing the farplane culling distance of your main camera or decreasing the projection sphere radius.", MessageType.Warning);
				}
			}
		}
	}
	
	#endif
}