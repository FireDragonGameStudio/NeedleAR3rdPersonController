using Needle.Engine.Components;
using UnityEngine.Video;

namespace Needle.Engine.AdditionalData
{
	public enum AspectMode
	{
		None = 0,
		AdjustHeight = 1,
		AdjustWidth = 2
	}
	
	public class VideoPlayerData : AdditionalComponentData<VideoPlayer>
	{
		public bool playOnEnable = true;
		public AspectMode aspectMode = AspectMode.AdjustHeight; 
	}
}