using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class CameraARData : AdditionalComponentData<Camera>
	{
		[Range(0,1), Info("Overrides camera background alpha when in AR mode")]
		public float ARBackgroundAlpha = 0;
	}
}