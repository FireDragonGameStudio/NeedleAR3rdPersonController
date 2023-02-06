#if UNITY_EDITOR

using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public static class AnimationWindowUtil
	{
		public static bool IsPreviewing()
		{
			var animationWindow = Resources.FindObjectsOfTypeAll<AnimationWindow>().FirstOrDefault(w => w);
			if (animationWindow)
			{
				return animationWindow.state.previewing;
			}
			return false;
		}
		
		public static void StartPreview()
		{
			var animationWindow = Resources.FindObjectsOfTypeAll<AnimationWindow>().FirstOrDefault(w => w);
			if (animationWindow)
			{
				animationWindow.state.StartPreview();
			}
		}

		public static void StopPreview()
		{
			var animationWindow = Resources.FindObjectsOfTypeAll<AnimationWindow>().FirstOrDefault(w => w);
			if (animationWindow)
			{
				animationWindow.state.StopPreview();
			}
		}
	}
}

#endif