using System;
using UnityEngine;

namespace Needle.Engine.Components
{
	[Flags]
	public enum DeviceType
	{
		Never = 0,
		Desktop = 1 << 0,
		Mobile = 2 << 0,
	}
	
	[HelpURL(Constants.DocumentationUrl)]
	public class DeviceFlag : MonoBehaviour
	{
		public DeviceType VisibleOn = DeviceType.Desktop | DeviceType.Mobile;
	}
}