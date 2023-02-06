using System;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	[HelpURL(Constants.DocumentationUrl)]
	public class DeployToGlitch : MonoBehaviour
	{
		public GlitchModel Glitch;

		// ReSharper disable once Unity.RedundantEventFunction
		private void OnEnable()
		{
			// just for editor
		}

		[ContextMenu("Open Starter Project on Glitch")]
		private void OpenGlitchStarter()
		{
			Application.OpenURL(DeployToGlitchUtils.TemplateUrl);
		}
	}
}