using UnityEngine;
using UnityEngine.Events;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class SpatialTriggerReceiver : MonoBehaviour
	{
		public LayerMask TriggerMask;
		public UnityEvent OnEnter, OnStay, OnExit;
	}
}