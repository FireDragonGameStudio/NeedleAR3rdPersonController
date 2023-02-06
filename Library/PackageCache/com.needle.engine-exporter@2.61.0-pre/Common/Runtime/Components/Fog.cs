using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	[AddComponentMenu("")]
	internal class Fog : MonoBehaviour
	{
		public FogMode mode;
		public Color color;
		public float density;
		public float near;
		public float far;
	}
	
	#if UNITY_EDITOR
	[CustomEditor(typeof(Fog))]
	internal class FogEditor : Editor
	{
		private void OnEnable()
		{
			EditorApplication.delayCall += () => DestroyImmediate(this.target);
		}
	}
#endif
}