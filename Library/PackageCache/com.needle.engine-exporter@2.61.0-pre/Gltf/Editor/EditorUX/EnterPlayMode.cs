using Needle.Engine.Utils;
using UnityEditor;

namespace Needle.Engine.Gltf
{
	internal static class EnterPlayMode
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			Engine.EnterPlayMode.OverridePlayModeNotInExportScene += OnEnterPlayMode;
		}

		private static bool OnEnterPlayMode()
		{
			if (EditorActions.TryExportCurrentScene()) return true;
			return false;
		}
	}
}