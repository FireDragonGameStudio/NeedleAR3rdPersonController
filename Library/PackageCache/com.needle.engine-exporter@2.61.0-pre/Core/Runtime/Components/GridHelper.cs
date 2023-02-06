using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class GridHelper : MonoBehaviour
	{
		public bool isGizmo = false;
		public int size = 10;
		public int divisions = 10;
		public float offset = 0.001f;
		[ColorUsage(false)] public Color color0 = new Color(.25f, .25f, .25f);
		[ColorUsage(false)] public Color color1 = new Color(.18f, .18f, .18f);

		private void OnDrawGizmos()
		{
			var t = transform;
			var rot = t.rotation;
			Gizmos.matrix = Matrix4x4.TRS(t.position + rot * new Vector3(0, offset, 0), rot, t.lossyScale * this.size);
			Gizmos.color = color0;
			Gizmos.DrawWireCube(Vector3.zero, new Vector3(1, 0, 1));

			const float hs = .5f;
			var step = 1f / divisions;
			for (var x = -.5f; x < .5f; x += step)
			{
				for (var y = -.5f; y < .5f; y += step)
				{
					var x0 = x;
					var x1 = hs;
					var y0 = y;
					var y1 = hs;

					Gizmos.DrawLine(new Vector3(x0, 0, y0), new Vector3(x0, 0, y1));
					Gizmos.DrawLine(new Vector3(x0, 0, y0), new Vector3(x1, 0, y0));
				}
			}
		}
	}
}