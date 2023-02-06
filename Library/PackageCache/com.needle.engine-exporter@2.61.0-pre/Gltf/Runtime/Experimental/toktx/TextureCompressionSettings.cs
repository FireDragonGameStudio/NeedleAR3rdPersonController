using System;
using GLTF;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Gltf.Experimental
{
	[HelpURL(Constants.DocumentationUrl)]
	public class TextureCompressionSettings : MonoBehaviour
	{
		// ReSharper disable once Unity.RedundantEventFunction
		private void OnEnable()
		{
			// we want to show the enable toggle
		}

		public virtual CompressionSettingsModel GetSettings(IExportContext context, TextureExportSettings texture, string textureSlot)
		{
			return new CompressionSettingsModel();
		}
	}

	public struct CompressionSettingsModel
	{
		public string mode;
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(TextureCompressionSettings))]
	public class TextureCompressionSettingsEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			EditorGUILayout.HelpBox("Adding this component to your scene OR a GameObject with a GltfObject component will modify toktx texture compression settings by slot. Disable this component to disable default compression settings.", MessageType.Info);
			
			var comp = target as Component;
			if (!comp) return;
			
			// if (!comp.TryGetComponent<IExportableObject>(out _))
			// {
			// 	EditorGUILayout.HelpBox("This GameObject has no GltfObject component", MessageType.Warning);
			// }
			// base.OnInspectorGUI();
		}
	}
#endif
}