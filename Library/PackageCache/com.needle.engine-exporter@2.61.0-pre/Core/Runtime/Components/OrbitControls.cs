using UnityEngine;
using UnityEngine.Animations;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class OrbitControls : MonoBehaviour
	{
		public bool autoRotate = false;
		public float autoRotateSpeed = .2f;
		public bool enableKeys = true;
		public bool enableDamping = true;
		[Range(0.001f, 1), Tooltip("Low values translate to more damping")]
		public float dampingFactor = .1f;
		public bool enableZoom = true;
		public float minZoom = 0;
		public float maxZoom = float.PositiveInfinity; 
		public bool enablePan = true;
		public LookAtConstraint lookAtConstraint;
		public bool middleClickToFocus = true;
		public bool doubleClickToFocus = true;


		private void OnEnable()
		{
			
		}
	}
}