using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Needle.Engine
{
	public static class EditorGUILayoutAccess
	{
		private static readonly BuildPlatform[] _platforms = new BuildPlatform[]
		{
			BuildPlatformConstants.None,
			BuildPlatformConstants.Platform,
		};

		private static GUIStyle _platformGroupingStyle;

		public static bool BeginPlatformGrouping(float marginRight = 0)
		{
			_platformGroupingStyle ??= new GUIStyle(EditorStyles.frameBox);
#if UNITY_EDITOR_WIN
			if(marginRight > 0)
				_platformGroupingStyle.fixedWidth = Screen.width - marginRight;
			else 
				_platformGroupingStyle.fixedWidth = 0;
#endif
			var index = EditorGUILayout.BeginPlatformGrouping(_platforms, null, _platformGroupingStyle);
			return index == 1;
		}

		public static void EndPlatformGrouping()
		{
			EditorGUILayout.EndPlatformGrouping();
		}
	}
}