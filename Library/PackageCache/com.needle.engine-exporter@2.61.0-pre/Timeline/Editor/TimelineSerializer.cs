using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Reflection;
using Needle.Engine.Gltf;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Timeline;
using UnityGLTF.Extensions;
using Object = UnityEngine.Object;

namespace Needle.Engine.Timeline
{
	public class PlayableDirectorExportContext
	{
		public PlayableDirector Director;
		public IExportContext ExportContext;
		public TrackExportContext CurrentTrack;

		/// <summary>
		/// Key is either a TimelineClip or an AnimationClip if the track is in infinite mode
		/// </summary>
		public readonly Dictionary<object, int> ClipMap = new Dictionary<object, int>();

		public PlayableDirectorExportContext(PlayableDirector director, IExportContext exportContext)
		{
			Director = director;
			ExportContext = exportContext;
		}
	}

	public class TrackExportContext
	{
		public readonly List<Object> Bindings = new List<Object>();
	}

	public static class TimelineSerializer
	{
		public delegate void CreateModelEvent(object asset, ref object model);

		public static event CreateModelEvent CreateModel;

		public const string ExportMutedAssetLabel = "ExportMuted";
		
		/// <summary>
		/// Called before a track is added to the serialization model. Useful to e.g. control a tracks mute state to be added to the model or not (if a track is muted it is not added by default 
		/// </summary>
		public static event Action<PlayableDirector, TrackAsset> BeforeAddTrack;
		/// <summary>
		/// Director, Asset, Bool if it was added
		/// </summary>
		public static event Action<PlayableDirector, TrackAsset, bool> AfterAddTrack;

		public static bool TryExportPlayableAsset(PlayableDirectorExportContext context, TimelineAsset asset, out object result)
		{
			// evaluate the timeline once to make sure the data is up to date
			// this fixes an issue we had for one timeline when building the website
			// where exported clips/offset/... were not correct and the timeline had
			// always to be opened once in the timeline window to be exported correctly.
			if (context.Director)
			{
				TimelineUtils.EvaluateTimeline(context.Director);
			}

			var tags = AssetDatabase.GetLabels(asset);
			var ignoreMuted = true;
			foreach (var tag in tags)
			{
				if(tag.Equals(ExportMutedAssetLabel, StringComparison.OrdinalIgnoreCase)) ignoreMuted = false;	
			}

			var exp = new TimelineAssetModel();
			exp.name = asset.name;
			exp.guid = asset.GetId();
			foreach (var track in asset.GetOutputTracks())
			{
				BeforeAddTrack?.Invoke(context.Director, track);
				var shouldAdd = !ignoreMuted || track.mutedInHierarchy == false;
				if (shouldAdd)
				{
					AddTrack(exp, context.Director, track, context);
				}
				AfterAddTrack?.Invoke(context.Director, track, shouldAdd);
			}
			result = exp;
			return true;
		}

		private static bool _triedGettingSceneOffsetProperties;
		private static PropertyInfo _sceneOffsetPositionProp, _sceneOffsetRotationProp;
		private static Quaternion _sceneOffsetRotationTempQuat = new Quaternion();
		

		public static void AddTrack(TimelineAssetModel timelineAssetModel,
			PlayableDirector dir,
			TrackAsset track,
			PlayableDirectorExportContext context)
		{
			
			var tr = new TimelineTrackModel();
			tr.name = track.name;
			tr.type = track.GetType().Name;
			tr.muted = track.muted;
			context.CurrentTrack ??= new TrackExportContext();
			var trackContext = context.CurrentTrack;
			trackContext.Bindings.Clear();
			foreach (var output in track.outputs)
			{
				var binding = dir.GetGenericBinding(output.sourceObject);
				if (binding)
				{
					trackContext.Bindings.Add(binding);
					tr.outputs.Add(binding.GetId());
				}
				else tr.outputs.Add(null);
			}
			timelineAssetModel.tracks.Add(tr);

			if (track is AnimationTrack animationTrack)
			{
				tr.trackOffset = new TrackOffset();
				switch (animationTrack.trackOffset)
				{
					case UnityEngine.Timeline.TrackOffset.ApplySceneOffsets:
						if (_sceneOffsetPositionProp == null)
						{
							if (_triedGettingSceneOffsetProperties) break;
							_triedGettingSceneOffsetProperties = true;
							_sceneOffsetPositionProp =
								typeof(AnimationTrack).GetProperty("sceneOffsetPosition", BindingFlags.Instance | BindingFlags.NonPublic);
							_sceneOffsetRotationProp = typeof(AnimationTrack).GetProperty("sceneOffsetRotation", BindingFlags.Instance | BindingFlags.NonPublic);
							if(_sceneOffsetPositionProp == null || _sceneOffsetRotationProp == null)
								break;
						}
						tr.trackOffset.position = new Vec3((Vector3)_sceneOffsetPositionProp.GetValue(animationTrack));
						var rot = (Vector3)_sceneOffsetRotationProp.GetValue(animationTrack);
						_sceneOffsetRotationTempQuat.eulerAngles = rot;
						tr.trackOffset.rotation = new Quat(_sceneOffsetRotationTempQuat.ToGltfQuaternionConvert());
						break;

					case UnityEngine.Timeline.TrackOffset.Auto:
					case UnityEngine.Timeline.TrackOffset.ApplyTransformOffsets:
						tr.trackOffset.position = new Vec3(animationTrack.position);
						tr.trackOffset.rotation = new Quat(animationTrack.rotation.ToGltfQuaternionConvert());
						break;
				}

				if (animationTrack.inClipMode == false && animationTrack.infiniteClip)
				{
					var cl = new TimelineClipModel();
					cl.start = animationTrack.start;
					cl.end = animationTrack.end;
					cl.duration = animationTrack.duration;
					cl.timeScale = 1;
					CreateAnimationClipModel(context, tr, cl,
						TimelineAnimationClipInfo.CreateFromInfiniteTrack(animationTrack),
						animationTrack.infiniteClip, animationTrack.infiniteClip);
					tr.clips.Add(cl);
				}
			}

			foreach (var clip in track.GetClips()) AddClip(tr, clip, context);
			foreach (var marker in track.GetMarkers()) AddMarker(tr, marker, context);
		}

		private static readonly Dictionary<Type, FieldInfo[]> fieldsForType = new Dictionary<Type, FieldInfo[]>();

		public static void AddClip(TimelineTrackModel timelineTrackModel, TimelineClip clip, PlayableDirectorExportContext context)
		{
			var cl = new TimelineClipModel();
			cl.start = clip.start;
			cl.end = clip.end;
			cl.duration = clip.duration;
			cl.timeScale = clip.timeScale;
			cl.clipIn = clip.clipIn;
			cl.easeInDuration = clip.blendInDuration >= 0 ? clip.blendInDuration : clip.easeInDuration;
			cl.easeOutDuration = clip.blendOutDuration >= 0 ? clip.blendOutDuration : clip.easeOutDuration;
			cl.preExtrapolationMode = (int)clip.preExtrapolationMode;
			cl.postExtrapolationMode = (int)clip.postExtrapolationMode;
			timelineTrackModel.clips.Add(cl);
			switch (clip.asset)
			{
				default:
					if (clip.asset)
					{
						CreateModel?.Invoke(clip.asset, ref cl.asset);
						if (cl.asset == null)
						{
							// automatically create a model when none is provided via callback
							var assetType = clip.asset.GetType();
							var serializable = typeof(SerializeField);
							var obj = new ExpandoObject() as IDictionary<string, object>;
							cl.asset = obj;
							if (!fieldsForType.TryGetValue(assetType, out var fields))
							{
								fields = assetType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
								fieldsForType.Add(assetType, fields);
							}
							foreach (var type in fields)
							{
								if (type.GetCustomAttribute(serializable) != null)
								{
									obj.Add(type.Name, type.GetValue(clip.asset));
								}
							}
						}
					}
					break;
				case ControlPlayableAsset control:
					var target = control.sourceGameObject.Resolve(context.Director);
					if (target)
					{
						var controlModel = new ControlClipModel();
						controlModel.sourceObject = target.GetId();
						controlModel.controlActivation = control.active;
						controlModel.updateDirector = control.updateDirector;
						cl.asset = controlModel;
					}
					break;
				case AudioPlayableAsset audio:
					var audioClip = audio.clip;
					if (audioClip)
					{
						var model = new AudioCLipModel();
						// TODO: get volume from playable
						// var audioClipProperties = audioClipPlayable.GetHandle().GetObject<AudioClipProperties>();
						model.loop = audio.loop;
						model.clip = audioClip; // AudioResolver.ExportAudioClip(audioClip, context.ExportContext.AssetsDirectory);
						cl.asset = model;
					}
					else
					{
						// dont export audio clip track with missing clip
						timelineTrackModel.clips.Remove(cl);
					}
					break;
				case AnimationPlayableAsset anim:
					CreateAnimationClipModel(context, timelineTrackModel, cl,
						TimelineAnimationClipInfo.CreateFromAsset(anim), anim.clip, clip);
					break;
			}
		}

		private struct TimelineAnimationClipInfo
		{
			public string name;
			public bool removeStartOffset;
			public Vector3 position;
			public Quaternion rotation;
			public AnimationPlayableAsset.LoopMode loop;

			public static TimelineAnimationClipInfo CreateFromInfiniteTrack(AnimationTrack track)
			{
				Debug.Assert(track.inClipMode == false);
				Debug.Assert(track.infiniteClip);
				var useOffset = track.infiniteClip?.UseOffsets() ?? true;
				return new TimelineAnimationClipInfo()
				{
					name = track.name,
					removeStartOffset = false,
					position = useOffset ? track.infiniteClipOffsetPosition : Vector3.zero,
					rotation = useOffset ? track.infiniteClipOffsetRotation : Quaternion.identity
				};
			}

			public static TimelineAnimationClipInfo CreateFromAsset(AnimationPlayableAsset asset)
			{
				var useOffset = asset.clip?.UseOffsets() ?? true;
				return new TimelineAnimationClipInfo()
				{
					removeStartOffset = asset.removeStartOffset,
					position = useOffset ? asset.position : Vector3.zero,
					rotation = useOffset ? asset.rotation : Quaternion.identity,
					loop = asset.loop,
					name = asset.name
				};
			}
		}

		private static AnimationClipModel CreateAnimationClipModel(PlayableDirectorExportContext context,
			TimelineTrackModel timelineTrackModel,
			TimelineClipModel cl,
			TimelineAnimationClipInfo anim,
			AnimationClip clip,
			object key)
		{
			if (!clip) return null;
			if (context.ClipMap.TryGetValue(key, out var id))
			{
				var animClipModel = new AnimationClipModel();
				cl.asset = animClipModel;
				animClipModel.clip = id.AsAnimationPointer();
				animClipModel.duration = clip.length;
				animClipModel.removeStartOffset = anim.removeStartOffset;
				animClipModel.position = new Vec3(anim.position);
				animClipModel.position.x *= -1;
				// (animClipModel.position.x, animClipModel.position.z) = (animClipModel.position.z, animClipModel.position.x);
				animClipModel.rotation = new Quat(anim.rotation.ToGltfQuaternionConvert());
				switch (anim.loop)
				{
					default:
					case AnimationPlayableAsset.LoopMode.UseSourceAsset:
						animClipModel.loop = clip.isLooping;
						break;
					case AnimationPlayableAsset.LoopMode.On:
						animClipModel.loop = true;
						break;
					case AnimationPlayableAsset.LoopMode.Off:
						animClipModel.loop = false;
						break;
				}
				return animClipModel;
			}
			var hasAnyOutput = timelineTrackModel.outputs.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) != null;
			if (hasAnyOutput)
				Debug.LogWarning(
					$"Some animation clips could not be found/exported for \"{anim.name}/{clip.name}\". The objects might be disabled or the clips may need KHR_animation_pointer support.",
					clip);
			return null;
		}

		public static void AddMarker(TimelineTrackModel timelineTrackModel, IMarker marker, PlayableDirectorExportContext context)
		{
			switch (marker)
			{
				case SignalEmitter emitter:
					var model = new TimelineSignalEmitterMarkerModel();
					model.type = nameof(SignalEmitter);
					model.time = (float)emitter.time;
					model.retroActive = emitter.retroactive;
					model.emitOnce = emitter.emitOnce;
					model.asset = emitter.asset.GetId();
					timelineTrackModel.markers.Add(model);
					break;
			}
		}
	}
}