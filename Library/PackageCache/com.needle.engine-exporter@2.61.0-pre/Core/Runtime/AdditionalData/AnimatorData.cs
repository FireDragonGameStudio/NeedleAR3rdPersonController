using Needle.Engine.Components;
using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class AnimatorData : AdditionalComponentData<Animator>
	{
		public Vector2 minMaxSpeed = Vector2.one;
		public Vector2 minMaxOffsetNormalized = Vector2.zero;
	}
}