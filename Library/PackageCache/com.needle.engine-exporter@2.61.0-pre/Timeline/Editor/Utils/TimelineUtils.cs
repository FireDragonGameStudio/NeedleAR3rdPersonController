#nullable enable

using System.Collections.Generic;
using System.Reflection;
using JetBrains.Annotations;
using UnityEditor.Timeline;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Timeline;

namespace Needle.Engine.Timeline
{
	public static class TimelineUtils
	{
		internal static void EvaluateTimeline(PlayableDirector dir)
		{
			var window = TimelineEditor.GetWindow();
			var didCreateWindow = !window;
			if (!window) window = TimelineEditor.GetOrCreateWindow();
			AnimationWindowUtil.StartPreview();
			window.SetTimeline(dir);
			dir.RebuildGraph();
			window.ClearTimeline();
			AnimationWindowUtil.StopPreview();
			if(didCreateWindow) window.Close();
		}
		
		public struct TimelineClipInfo
		{
			public Component Owner;
			public TimelineClip? TimelineClip;
			public AnimationClip AnimationClip;
			public bool IsInfiniteClip;

			public TimelineClipInfo(Component owner, TimelineClip? timelineClip, AnimationClip animationClip, bool isInfiniteClip)
			{
				Owner = owner;
				TimelineClip = timelineClip;
				AnimationClip = animationClip;
				IsInfiniteClip = isInfiniteClip;
			}
		}

		public static IEnumerable<TimelineClipInfo> EnumerateAnimationClips(PlayableDirector dir)
		{
			var asset = dir.playableAsset as TimelineAsset;
			if (!asset || asset == null) yield break;
			foreach (var track in asset.GetOutputTracks())
			{
				if (track is AnimationTrack animationTrack && (track.hasClips || track.hasCurves || !animationTrack.inClipMode))
				{
					foreach (var output in track.outputs)
					{
						var binding = dir.GetGenericBinding(output.sourceObject);
						if (!binding) continue;
						if (binding is Animator animator)
						{
							if (animationTrack.inClipMode)
							{
								foreach (var clip in animationTrack.GetClips())
								{
									yield return new TimelineClipInfo(animator, clip, clip.curves ? clip.curves : clip.animationClip, false);
								}
							}
							else if (animationTrack.infiniteClip)
							{
								yield return new TimelineClipInfo(animator, null, animationTrack.infiniteClip, true);
							}
						}
					}
				}
			}
		}

		private static bool triedGettingHasRootTransformsMethod;
		private static MethodInfo? _hasRootTransforms;
		private static readonly object[] _hasRootTransformsArgs = new object[1];

		internal static bool UseOffsets(this AnimationClip clip)
		{
			if (_hasRootTransforms == null && !triedGettingHasRootTransformsMethod)
			{
				triedGettingHasRootTransformsMethod = true;
				_hasRootTransforms = typeof(AnimationPlayableAsset).GetMethod("HasRootTransforms", BindingFlags.NonPublic | BindingFlags.Static);
			}
			
			if (_hasRootTransforms != null)
			{
				_hasRootTransformsArgs[0] = clip;
				return (bool)_hasRootTransforms.Invoke(null, _hasRootTransformsArgs);
			}

			return true;
		}
	}
}