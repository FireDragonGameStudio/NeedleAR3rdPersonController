using System;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	[HelpURL("https://docs.needle.tools/deployment")]
	public class DeployToFTP : MonoBehaviour
	{
		public FTPServer FTPServer;
		public string Path = "/";

		private void OnValidate()
		{
			Path = Path?.Trim();
		}
	}
}