using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class WebXR : MonoBehaviour 
	{
		public bool enableVR = true;
		public bool enableAR = true;
		
		[Info("Assign a prefab to be exported as your default WebXR avatar")]
		public Transform defaultAvatar;

		[Header("UI")]
		public bool createVRButton = true;
		public bool createARButton = true;
		
		
		[Header("Hands (optional)")]
		[Tooltip("Path where left.glb and right.glb can be found which are used as hand tracking models.\n" +
		         "By default, hand models will be loaded from\n" +
		         "\"https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/\"\n" + 
		         "If you want to use local hand meshes, a typical path is " + "\"assets/\".")]
		public string handModelPath = "";
		
		public void endSession() {}
	}
}