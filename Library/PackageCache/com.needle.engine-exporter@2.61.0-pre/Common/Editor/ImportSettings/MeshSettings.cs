using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Gltf.ImportSettings
{
	[Serializable]
	public class MeshSettings : AssetSettings
	{
		public bool @override = false;
		
		[Header("Simplification")] public bool useSimplifier;

		[Range(0.0f, 1.0f)] public float ratio = .5f;
		[Range(0, 1f)] public float error = .001f;
		public bool lockBorder = false;

		
		internal override bool OnGUI()
		{
			@override = EditorGUILayout.ToggleLeft("Override for Needle Engine", @override);
			GUI.enabled = @override;
			useSimplifier = EditorGUILayout.Toggle("Use Mesh Simplifier", useSimplifier);
			using(new EditorGUI.DisabledScope(!useSimplifier))
			{
				ratio = EditorGUILayout.Slider(new GUIContent("Ratio", "Target ratio (0–1) of vertices to keep. Default: 0.5 (50%)"), ratio, 0.0f, 1.0f);
				error = EditorGUILayout.Slider(new GUIContent("Error", "Limit on error, as a fraction of mesh radius. Default: 0.01 (1%)."), error, 0.0f, 1f);
				lockBorder = EditorGUILayout.Toggle(new GUIContent("Lock Border", "Whether to lock topological borders of the mesh. May be necessary when adjacent 'chunks' of a large mesh (e.g. terrain) share a border, helping to ensure no seams appear."), lockBorder);
			}
			return false;
		}
	}
}