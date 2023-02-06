using System;
using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class BoxGizmo : MonoBehaviour
	{
		public bool objectBounds = false;
		public Color color = Color.yellow;
		[Tooltip("When enabled this object will only render when your url contains ?gizmos")]
		public bool isGizmo = true;

		private void OnDrawGizmos()
		{
			Gizmos.matrix = transform.localToWorldMatrix;
			Gizmos.color = color;
			Gizmos.DrawWireCube(Vector3.zero, Vector3.one);
		}
	}
}