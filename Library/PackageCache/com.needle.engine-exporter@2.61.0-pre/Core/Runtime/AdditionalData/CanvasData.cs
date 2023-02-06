using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class CanvasData : AdditionalComponentData<Canvas>
	{
		public bool renderOnTop = false;
		public bool doubleSided = true;
		// public bool depthWrite = false;
		public bool castShadows = false;
		public bool receiveShadows = false;
	}
}