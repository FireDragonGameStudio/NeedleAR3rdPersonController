using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public class SceneSettings : MonoBehaviour, IExportableObject
	{
		public bool Export(string path, bool force, IExportContext context)
		{
#if UNITY_EDITOR
			// var opts = new ExportUtils.Options();
			// opts.afterExport = (exp, root) =>
			// {
			// 	// maybe we can export things directly at some point
			// 	// exp.ExportTexture(new Texture2D(1, 1), GLTFSceneExporter.TextureMapType.Unknown);
			// };
			var exporter = ExportUtils.GetExporter(this.transform, out _);
			ExportUtils.ExportWithUnityGltf(exporter, path, true);
			return true;
#else
			return false;
#endif
		}
	}

#if UNITY_EDITOR
	[CustomEditor(typeof(SceneSettings))]
	internal class SceneSettingsEditor : Editor
	{
		public override void OnInspectorGUI()
		{
			base.OnInspectorGUI();
			EditorGUILayout.HelpBox(
				"This component is typically only generated on export, you should not see this normally in your scene. If you did not add it on purpose this is most likely a bug and you can delete this GameObject",
				MessageType.Warning);
		}
	}
#endif
}