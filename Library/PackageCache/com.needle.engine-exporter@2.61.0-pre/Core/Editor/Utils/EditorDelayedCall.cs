using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	internal static class EditorDelayedCall
	{
		internal static void RunDelayed(Action action)
		{
			EditorApplication.delayCall += () => DelayWindow.Run(action);
		}

		private class DelayWindow : EditorWindow
		{
			private static DelayWindow instance;

			internal static void Run(Action act)
			{
				if (!instance)
					instance = ScriptableObject.CreateInstance<DelayWindow>();
				instance.action = act;
				instance.minSize = Vector2.zero;
				instance.maxSize = Vector2.one;
				instance.position = new Rect(0, 0, 1, 1);
				instance.Show();
			}

			private Action action;

			private void OnGUI()
			{
				action?.Invoke();
				action = null;
				Close();
			}
		}
	}
}