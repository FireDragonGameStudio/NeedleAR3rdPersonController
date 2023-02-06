using System;
using UnityEngine;

namespace Needle.Engine.Components.Experimental
{
	public class CharacterControllerInput : MonoBehaviour
	{
		[Info("This component is experimental and will likely change.\nDo not use in production yet!", InfoAttribute.InfoType.Warning)]
		public CharacterController controller;
		public Animator animator;
		[Tooltip("Meter per second")]
		public float movementSpeed = .3f;
		[Tooltip("Degrees per second")]
		public float rotationSpeed = 45;
		public float jumpForce = .5f;
		public bool lookForward = true;

		private void OnValidate()
		{
			if (!controller)
				TryGetComponent(out controller);
		}
	}
}