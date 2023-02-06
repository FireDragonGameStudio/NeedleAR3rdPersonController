using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	public enum SpectatorMode
	{
		FirstPerson = 0,
		ThirdPerson = 1,
	}
	
	[HelpURL(Constants.DocumentationUrl)]
	[RequireComponent(typeof(Camera))]
	public class SpectatorCamera : MonoBehaviour
	{
		public SpectatorMode mode = SpectatorMode.FirstPerson;
		public bool useKeys = true;
	}
}
