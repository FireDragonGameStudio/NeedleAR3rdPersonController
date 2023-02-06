using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class Voip : MonoBehaviour
	{
		[Tooltip("When enabled voip must explicitly enabled via URL parameter")]
		public bool requireParam = false;

		public bool muteInput = false;
		public bool muteOutput = false;
	}
}