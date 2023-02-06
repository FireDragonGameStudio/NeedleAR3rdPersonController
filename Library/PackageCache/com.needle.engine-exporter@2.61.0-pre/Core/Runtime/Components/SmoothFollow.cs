using System;
using UnityEngine;

namespace Needle.Engine.Components
{
	[Flags]
	public enum Axes
	{
		None = 0,
		X = 2,
		Y = 4,
		Z = 8,
	}

	[HelpURL(Constants.DocumentationUrl)]
	public class SmoothFollow : MonoBehaviour
	{
		public Transform target;
		public float followFactor = 1;
		public float rotateFactor = 1;
		public Axes positionAxes = (Axes)~0;
		// public Axes rotationAxes = (Axes)~0;

		private void OnEnable()
		{
		}
	}
}