using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class AnimationData : AdditionalComponentData<Animation>
	{
		public bool loop = true;
		public bool clampWhenFinished = false;
		public Vector2 minMaxSpeed = Vector2.one;
		public Vector2 minMaxOffsetNormalized = Vector2.zero;
	}
}