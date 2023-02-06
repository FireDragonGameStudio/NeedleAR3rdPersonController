using System;
using UnityEngine;

namespace Needle.Engine.Components
{
	[Flags]
	public enum XRState
	{
		Never = 0,
		Browser = 1 << 0,
		AR = 1 << 1,
		VR = 1 << 2,
		FirstPerson = 1 << 3,
		ThirdPerson = 1 << 4,
	}

	[HelpURL(Constants.DocumentationUrl)]
	public class XRFlag : MonoBehaviour
	{
		public XRState VisibleIn = (XRState)(~0);

		[ContextMenu(nameof(VisibleIn))]
		private void Print()
		{
			Debug.Log((VisibleIn & (XRState.VR | XRState.FirstPerson)).ToString());
		}
	}
}