using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Serialization;

namespace Needle.Engine.Components
{
	[ExecuteAlways]
	[HelpURL(Constants.DocumentationUrl)]
	public class SyncedRoom : MonoBehaviour
	{
		[Info("Required component to support networking. Handles connecting clients to rooms")]
		[Tooltip("The room name prefix")]
		public string roomName = null;
		[Tooltip("The room name parameter name in the url: for example ?room=123")]
		public string urlParameterName = "room";
		[Tooltip("Joins random room if the url does not contain a room name yet")]
		public bool joinRandomRoom = true;
		[FormerlySerializedAs("requireRoom"), Tooltip("If enabled clients wont connect to any room unless their url contains a room parameter. If disabled clients will automatically connect to the default room (e.g. when no room name in the url will be found it will just be the base roomName)")] 
		public bool requireRoomParameter = false;

		[Tooltip("Attempt to auto rejoin a room if user was disconnected from networking backend (e.g. server kicked user due to inactivity)")]
		public bool autoRejoin = true;
		
		private void OnValidate()
		{
			if (roomName == null || roomName.Length <= 0)
			{
				roomName = SceneManager.GetActiveScene().name;
			}
		}
	}
}