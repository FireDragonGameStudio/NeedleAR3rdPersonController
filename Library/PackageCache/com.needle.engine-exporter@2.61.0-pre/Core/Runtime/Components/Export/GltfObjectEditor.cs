#if UNITY_EDITOR
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	[CustomEditor(typeof(GltfObject))]
	public class GltfObjectEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			var gltfObject = target as GltfObject;
			if (!gltfObject)
			{
				base.OnInspectorGUI();
				return;
			}

			var isNested = ObjectUtils.GetComponentInParent<IExportableObject>(gltfObject.transform.parent?.gameObject) != null;
			if (isNested)
			{
				EditorGUILayout.HelpBox("You have nested glTF objects. This feature is currently in experimental state.", MessageType.Info);
			}

			var justCopy = gltfObject.CopyInsteadOfExport(out _);
			if (justCopy)
			{
				EditorGUILayout.HelpBox("This GameObject will just be copied to the output directory on export because it is already a gltf asset", MessageType.Info);
				
				gltfObject.CheckForPrefabOverrideIssues(out var rootTransformError, out var overrideError);
				if (rootTransformError != null)
					EditorGUILayout.HelpBox(rootTransformError, MessageType.Error);
				if (overrideError != null)
					EditorGUILayout.HelpBox(overrideError, MessageType.Error);
			}

			using (new EditorGUI.DisabledScope(justCopy))
			{
				if (!justCopy)
					EditorGUILayout.HelpBox("Produces a glTF file from this hierarchy", MessageType.None);

				if (!isNested && !justCopy && !gltfObject.gameObject.activeInHierarchy && gltfObject.gameObject.CompareTag("EditorOnly") == false)
				{
					EditorGUILayout.HelpBox("This GameObject is disabled but not set to EditorOnly so it will be exported and loaded in your built website - this might not be intentional. If you do not want the object to be included in your website change the tag to EditorOnly",
						MessageType.Warning);
					EditorGUILayout.Space(5);
				}
				
				base.OnInspectorGUI();
			}
		}
	}
}
#endif