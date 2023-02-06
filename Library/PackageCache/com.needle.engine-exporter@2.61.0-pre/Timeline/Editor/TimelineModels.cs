using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace Needle.Engine.Timeline
{
	[Serializable]
	public class TimelineAssetModel
	{
		public string name;
		public string guid;
		public List<TimelineTrackModel> tracks = new List<TimelineTrackModel>();


		[JsonIgnore]
		public object Settings { get; set; } = new JsonSerializerSettings()
		{
			NullValueHandling = NullValueHandling.Ignore
		};
	}
	
	[Serializable]
	public class TimelineTrackModel
	{
		public string name;
		public string type;
		public bool muted = false;
		public List<string> outputs = new List<string>();
		public List<TimelineClipModel> clips = new List<TimelineClipModel>();
		public List<TimelineMarkerModel> markers = new List<TimelineMarkerModel>();
		public TrackOffset trackOffset;
	}

	[Serializable]
	public class TrackOffset
	{
		public Vec3 position;
		public Quat rotation;
	}

	[Serializable]
	public class TimelineClipModel
	{
		public double start;
		public double end;
		public double duration;
		public double timeScale;
		public object asset;
		public double clipIn;
		public double easeInDuration;
		public double easeOutDuration;
		public int preExtrapolationMode;
		public int postExtrapolationMode;
	}

	[Serializable]
	public class AnimationClipModel
	{
		public string clip;
		public bool loop;
		public float duration;
		public Vec3 position;
		public Quat rotation;
		public bool removeStartOffset;
	}

	public class Vec3
	{
		public float x, y, z;

		public Vec3(Vector3 vec)
		{
			this.x = vec.x;
			this.y = vec.y;
			this.z = vec.z;
		}
	}

	public class Quat
	{
		public float x, y, z, w;

		public Quat(Quaternion vec)
		{
			this.x = vec.x;
			this.y = vec.y;
			this.z = vec.z;
			this.w = vec.w;
		}

		public Quat(GLTF.Math.Quaternion vec)
		{
			this.x = vec.X;
			this.y = vec.Y;
			this.z = vec.Z;
			this.w = vec.W;
		}
	}

	[Serializable]
	public class AudioCLipModel
	{
		public object clip;
		public bool loop;
		public float volume = 1;
	}

	[Serializable]
	public class ControlClipModel
	{
		public string sourceObject;
		public bool controlActivation;
		public bool updateDirector;
	}

	[Serializable]
	public class TimelineMarkerModel
	{
		public string type;
		public float time;
	}

	[Serializable]
	public class TimelineSignalEmitterMarkerModel : TimelineMarkerModel
	{
		public bool retroActive;
		public bool emitOnce;
		public string asset;
	}

	// public class TimelineAnimationClipAsset
	// {
	// 	public string clipId;
	// }

	// [Serializable]
	// public class TimelineAnimationClipExport
	// {
	// 	public List<Curve> curves = new List<Curve>();
	//
	// 	[Serializable]
	// 	public class Curve
	// 	{
	// 		public string propertyName;
	// 		public string path = null;
	// 		public Keyframe[] keys;
	// 	}
	// }
}