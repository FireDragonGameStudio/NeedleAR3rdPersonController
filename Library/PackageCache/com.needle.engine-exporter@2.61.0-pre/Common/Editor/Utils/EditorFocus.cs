using System;
using UnityEditor;
using UnityEditorInternal;

namespace Needle.Engine.Utils
{
	public class EditorFocus
	{
		internal static event Action Focused, Unfocused;

		private static bool editorWasFocused;

		static EditorFocus()
		{
			EditorApplication.update += Update;
		}

		private static void Update()
		{
			var isApplicationActive = InternalEditorUtility.isApplicationActive;

			if (!editorWasFocused && isApplicationActive)
			{
				editorWasFocused = true;
				Focused?.Invoke();
			}
			else if (editorWasFocused && !isApplicationActive)
			{
				editorWasFocused = false;
				Unfocused?.Invoke();
			}
		}
	}
}