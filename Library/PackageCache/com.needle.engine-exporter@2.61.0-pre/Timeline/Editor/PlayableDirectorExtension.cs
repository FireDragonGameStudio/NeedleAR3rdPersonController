using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.Gltf;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEngine;
using UnityEngine.Playables;

namespace Needle.Engine.Timeline
{
	internal struct TimelineAnimationKey
	{
		public object owner;
		public AnimationClip clip;
	}

	// Timeline serialization must run before components so that the clips have been added
	[UsedImplicitly, Priority(100)]
	public class PlayableDirectorExtension : GltfExtensionHandlerBase
	{
		/// <summary>
		/// Map to only export an timeline animationclip once, the key contains the information used to check if the key was exported with the specific info
		/// </summary>
		private readonly Dictionary<TimelineAnimationKey, int> exportedAnimations = new Dictionary<TimelineAnimationKey, int>();

		private readonly List<PlayableDirectorExportContext> foundTimelines = new List<PlayableDirectorExportContext>();

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			exportedAnimations.Clear();
			foundTimelines.Clear();
		}

		public override void OnAfterNodeExport(GltfExportContext context, Transform transform, int nodeId)
		{
			base.OnAfterNodeExport(context, transform, nodeId);
			if (!transform.TryGetComponent(out PlayableDirector dir)) return;
			if (!dir.playableAsset) return;

			// create export context
			var directorExport = new PlayableDirectorExportContext(dir, context);
			context.RegisterValueResolver(new TimelineValueResolver(directorExport));

			foundTimelines.Add(directorExport);

			// var ext = new TimelineAssetExtension(directorExport);
			// context.Bridge.AddNodeExtension(nodeId, TimelineAssetExtension.EXTENSION_NAME, ext);
		}

		public override void OnAfterExport(GltfExportContext context)
		{
			base.OnAfterExport(context);

			foreach (var directorExport in foundTimelines)
			{
				var dir = directorExport.Director;
				if (ExporterProjectSettings.instance.debugMode)
					Debug.Log($"<color=#888888>Export Timeline: {dir.name}</color>", dir.gameObject);
				// first export all animations in timeline (make sure to only export clips once)
				foreach (var info in TimelineUtils.EnumerateAnimationClips(dir))
				{
					var clip = info.TimelineClip;
					var owner = info.Owner;
					if (EditorUtils.IsEditorOnly(owner, context.Root))
						continue;
					var animationClip = info.AnimationClip;

					// we need to get the animation index when building the timeline model
					// and we only want to export either each clip once of each infinite track once
					object clipMapKey = info.IsInfiniteClip ? info.AnimationClip : (object)info.TimelineClip;
					if (clip != null && directorExport.ClipMap.ContainsKey(clipMapKey)) continue;

					var key = new TimelineAnimationKey()
					{
						owner = owner,
						clip = animationClip,
					};
					// check if this exact animation has been exported before, if so just reuse the index
					if (!exportedAnimations.TryGetValue(key, out var index))
					{
						try
						{
							TimelinePreview.DisableTimelinePreview();
							if (ExporterProjectSettings.instance.debugMode)
								Debug.Log($"<color=#888888>Add timeline animation: {owner.name}/{animationClip?.name}</color>", animationClip);
							index = context.Bridge.AddAnimationClip(animationClip, owner.transform, 1);
							if (index < 0)
							{
								Debug.LogError(
									$"Could not export animation clip: {owner.name}/{animationClip?.name}. The object might be disabled/missing or it might require KHR_animation_pointer support.",
									owner);
								continue;
							}
							exportedAnimations.Add(key, index);
						}
						finally
						{
							TimelinePreview.ResetState();
						}
					}

					directorExport.ClipMap.Add(clipMapKey, index);
				}
			}
		}
	}
}