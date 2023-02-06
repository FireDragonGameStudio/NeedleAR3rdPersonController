using UnityEngine;

namespace Needle.Engine.Deployment
{
	[CreateAssetMenu(menuName = "Needle Engine/FTP Server Info")]
	public class FTPServer : ScriptableObject
	{
		public string Servername;
		public string Username;

		[HideInInspector]
		public string RemoteUrl;
		
		public bool RemoteUrlIsValid => !string.IsNullOrWhiteSpace(RemoteUrl) && (RemoteUrl.StartsWith("www") || RemoteUrl.StartsWith("http"));

		public bool TryGetKey(out string key)
		{
			key = Servername + Username;
			return !string.IsNullOrWhiteSpace(Servername) && !string.IsNullOrWhiteSpace(Username);
		}
		
		private void OnValidate()
		{
			Servername = Servername?.Trim();
			Username = Username?.Trim();
		}
	}
}