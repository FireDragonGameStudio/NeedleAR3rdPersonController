using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace Needle.Engine.Gltf.ImportSettings
{
	internal class ImportSettingsInject
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			InspectorHook.Inject += OnInject;
		}

		private static void OnInject(Editor editor, VisualElement element)
		{
			var isSupportedTarget = editor.target is Mesh || editor.target is Texture;
			if (!isSupportedTarget) return;

			var meshTargets = editor.targets.OfType<Mesh>().ToArray();
			if (meshTargets.Length > 0)
			{
				element.Add(new AssetSettingsInspector(meshTargets));
			}

			// only take subasset textures
			var textureTargets = editor.targets.OfType<Texture>().Where(AssetDatabase.IsSubAsset).ToArray();
			if (textureTargets.Length > 0)
			{
				element.Add(new AssetSettingsInspector(textureTargets));
			}
		}
	}
}