#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Needle.Engine.Codegen
{
	internal static class ComponentGeneratorWatcher
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorSceneManager.sceneOpened += (s, m) => componentGenerator = null;

			var count = 0;
			EditorApplication.update += () =>
			{
				count += 1;
				if (count > 600)
				{
					count = 0;
					if (!componentGenerator) componentGenerator = Object.FindObjectOfType<ComponentGenerator>();
					else if (componentGenerator.FileWatcherIsActive == false)
					{
						componentGenerator.UpdateWatcher();
					}
				}
			};
		}

		private static ComponentGenerator componentGenerator;
	}
}
#endif