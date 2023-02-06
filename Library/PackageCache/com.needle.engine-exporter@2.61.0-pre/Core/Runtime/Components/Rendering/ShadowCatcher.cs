using System;
using Needle.Engine.Utils;
using UnityEngine;
#if UNITY_EDITOR
using GLTF.Schema;
using UnityEditor;
using UnityEngine.Rendering;
#endif

namespace Needle.Engine.Components
{
	public class ShadowCatcher : UnityEngine.MonoBehaviour
	{
		public enum Mode
		{
			ShadowMask = 0,
			Additive = 1,
		}

		public Mode mode = Mode.ShadowMask;
		public UnityEngine.Color shadowColor = new Color(0, 0, 0, .5f);

		private MaterialPropertyBlock block;
		private static readonly int ShadowColor = Shader.PropertyToID("_ShadowColor");

		private void OnValidate()
		{
			if (TryGetComponent<UnityEngine.MeshRenderer>(out var r))
			{
				if (!r) return;
				if (block == null) block = new MaterialPropertyBlock();
				r.GetPropertyBlock(block);
				block.SetColor(ShadowColor, shadowColor);
				r.SetPropertyBlock(block);
			}
		}

		private void OnDrawGizmosSelected()
		{
			var meshFilter = GetComponent<MeshFilter>();
			if (meshFilter && meshFilter.sharedMesh)
			{
				Gizmos.matrix = transform.localToWorldMatrix;
				Gizmos.color = new Color(1, 1, 1, 0.02f);
				Gizmos.DrawWireMesh(meshFilter.sharedMesh);
			}
		}
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(ShadowCatcher))]
	internal class ShadowCatcherEditor : UnityEditor.Editor
	{
		private const string ShadowMaskMaterialGuid = "26ff8c4b7896bac4a8b87c1336ea2263";
		private const string AdditiveMaterialGuid = "47514e906d00e8d448b3bc2304fa4487";
		private const string AdditiveBirpMaterialGuid = "fca8f20d95d79da4dbb18ffa4a650183";
		
		private Material targetMaterial;
		private Material shadowMaskMaterial, additiveMaterial;

		private void OnEnable()
		{
			var t = target as ShadowCatcher;
			if (t && t.TryGetComponent(out MeshRenderer r))
			{
				targetMaterial = r.sharedMaterial;
			}
			shadowMaskMaterial = AssetDatabase.LoadAssetAtPath<Material>(AssetDatabase.GUIDToAssetPath(ShadowMaskMaterialGuid));
			var rightAdditiveMaterialGuid = GraphicsSettings.renderPipelineAsset ? AdditiveMaterialGuid : AdditiveBirpMaterialGuid;
			additiveMaterial = AssetDatabase.LoadAssetAtPath<Material>(AssetDatabase.GUIDToAssetPath(rightAdditiveMaterialGuid));
		}

		public override void OnInspectorGUI()
		{
			EditorGUILayout.HelpBox(
				"Shadow Catcher for transparent captures and Augmented Reality.\n" +
				"Use ShadowMask for high-contrast shadows, especially from Directional Lights, and Additive for Spot Lights and Point Lights. " +
				"Placing a quad with a dark gradient below the shadow catcher helps to make light shine in additive mode.",
				MessageType.None);

			DrawDefaultInspector();
			var t = target as ShadowCatcher;
			if (!t) return;
			var hasCorrectShader = true;
			switch (t.mode)
			{
				case ShadowCatcher.Mode.ShadowMask:
					hasCorrectShader = targetMaterial && targetMaterial.shader == shadowMaskMaterial.shader;
					break;
				case ShadowCatcher.Mode.Additive:
					hasCorrectShader = targetMaterial && targetMaterial == additiveMaterial;
					break;
			}

			if (!hasCorrectShader)
			{
				EditorGUILayout.Space(5);
				EditorGUILayout.HelpBox(
					"The renderer has not have the correct material assigned for " + t.mode +
					" shadows. Please click the button below to assign the material for " + t.mode + " shadows!", MessageType.Warning);
				EditorGUILayout.Space(1);
				if (GUILayout.Button("Assign Correct ShadowCatcher Material", GUILayout.Height(30)))
				{
					t.TryGetComponent(out MeshRenderer renderer);
					if (!renderer) renderer = Undo.AddComponent<MeshRenderer>(t.gameObject);

					if (!t.TryGetComponent(out MeshFilter _))
					{
						var obj = GameObject.CreatePrimitive(PrimitiveType.Quad);
						var quad = obj.GetComponent<MeshFilter>().sharedMesh;
						var meshFilter = Undo.AddComponent<MeshFilter>(t.gameObject);
						meshFilter.sharedMesh = quad;
						obj.SafeDestroy();

						Undo.RegisterCompleteObjectUndo(t.transform, "Scale and rotate shadow caster");
						// if we add a quad mesh make sure the thing is turned to face up once
						var transform = t.transform;
						transform.LookAt(Vector3.down);
						var scale = transform.localScale;
						scale.Scale(Vector3.one * 5);
						transform.localScale = scale;
					}

					if (renderer)
					{
						Undo.RegisterCompleteObjectUndo(renderer, "Change shadow material to " + t.mode);
						renderer.sharedMaterial = t.mode == ShadowCatcher.Mode.ShadowMask ? shadowMaskMaterial : additiveMaterial;
					}
				}
			}
		}
	}
#endif
}