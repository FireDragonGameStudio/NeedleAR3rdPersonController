using System.Reflection;
using Needle.Engine;
using Needle.Engine.Core;
using UnityEditor;
using UnityEditor.Timeline;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Timeline;

namespace Needle.Engine.Timeline
{
	// private List<IAnimationWindowPreview> previewed = new List<IAnimationWindowPreview>();
	// previewed.Clear();
	// ObjectUtils.FindObjectsOfType(previewed);
	// foreach(var prev in previewed) prev.StopPreview();

	public static class TimelinePreview
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			Builder.BuildStarting += DisableTimelinePreview;
			Builder.BuildEnded += ResetState;
		}

		private static PlayableDirector inspectedDirector;
		private static TimelineAsset inspectedAsset;
		private static GameObject selectedObject;
		// private static TimelinePreviewBridge _previewBridge = new TimelinePreviewBridge();

		internal static void DisableTimelinePreview()
		{
			var window = TimelineEditor.GetWindow();
			if (!window) return;
			if (TimelineEditor.inspectedAsset)
				inspectedAsset = TimelineEditor.inspectedAsset;
			if (TimelineEditor.inspectedDirector)
				inspectedDirector = TimelineEditor.inspectedDirector;
			window.ClearTimeline();
			
		}

		internal static void ResetState()
		{
			var window = TimelineEditor.GetWindow();
			if (window)
			{
				if (inspectedDirector)
					window.SetTimeline(inspectedDirector);
				else if (inspectedAsset)
					window.SetTimeline(inspectedAsset);
			}
			inspectedAsset = null;
			inspectedDirector = null;
		}

		// private class TimelinePreviewBridge
		// {
		// 	private static PropertyInfo timelineWindowStateField, previewModeProperty, recordingProperty;
		// 	private static MethodInfo setPlayingMethod;
		// 	private static readonly object[] setPlayingParams = new object[1] { false };
		// 	private object timelineWindowState;
		//
		// 	public void SetPreview(bool preview)
		// 	{
		// 		var window = TimelineEditor.GetWindow();
		// 		if (!window) return;
		// 		if (timelineWindowStateField == null)
		// 		{
		// 			timelineWindowStateField = window.GetType().GetProperty("state", BindingFlags.Default | BindingFlags.Instance | BindingFlags.Public);
		// 		}
		// 		if(timelineWindowState == null && timelineWindowStateField != null)
		// 			timelineWindowState = timelineWindowStateField.GetValue(window);
		// 		previewModeProperty ??= timelineWindowState?.GetType().GetProperty("previewMode", BindingFlags.Default | BindingFlags.Instance | BindingFlags.Public);
		// 		recordingProperty ??= timelineWindowState?.GetType().GetProperty("recording", BindingFlags.Default | BindingFlags.Instance | BindingFlags.Public);
		// 		setPlayingMethod ??= timelineWindowState?.GetType().GetMethod("SetPlaying", BindingFlags.Default | BindingFlags.Instance | BindingFlags.Public);
		// 		
		// 		
		// 		if (!preview)
		// 		{
		// 			setPlayingParams[0] = false;
		// 			setPlayingMethod?.Invoke(timelineWindowState, setPlayingParams);
		// 			recordingProperty?.SetValue(timelineWindowState, false);
		// 		}
		// 		
		// 		if (previewModeProperty != null && timelineWindowState != null)
		// 		{
		// 			previewModeProperty.SetValue(timelineWindowState, preview);
		// 		}
		//
		// 	}
		// }
	}
}