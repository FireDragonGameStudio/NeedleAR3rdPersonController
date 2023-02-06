using UnityEngine;

namespace Needle.Engine
{
	[AddComponentMenu(null)]
	internal class ImageReferenceTestComponent : MonoBehaviour
	{
		public ImageReference MyImage = new ImageReference();
		public ImageReference[] MyImages;
	}
}