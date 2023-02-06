using System;
using System.Threading;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	public static class DeploymentUtils
	{
		public static string GlitchProjectExistsUrl = null;
		public static bool? GlitchProjectExists { get; private set; } = null;
		public static bool GlitchProjectIsResponding { get; private set; }
		private static bool isWaitingForResponseFromGlitch = false;
		private static DateTime lastPingTime = DateTime.MinValue;
		private static bool requestedUpdate = false;
		private static int requestId = 0;

		internal static async void UpdateGlitchProjectExists(GlitchModel glitchModel, CancellationToken cancel = default, int id = default)
		{
			if (glitchModel == null) return;
			if (cancel.IsCancellationRequested) return;
			if (isWaitingForResponseFromGlitch)
			{
				requestedUpdate = true;
				return;
			}
			requestedUpdate = false;
			lastPingTime = DateTime.Now;
			if(id == default)
				id = ++requestId;

			var projectName = glitchModel.ProjectName;
			if (string.IsNullOrWhiteSpace(projectName))
			{
				GlitchProjectIsResponding = false;
				return;
			}
			isWaitingForResponseFromGlitch = true;
			try
			{
				// only reset state if the glitch project exists when the URL is not the same as last time
				// so when opening a project with another url (or pasting a link) it doesnt immediately show "doesnt exist"
				if (glitchModel.ProjectName != GlitchProjectExistsUrl)
					GlitchProjectExists = null;
				GlitchProjectExistsUrl = glitchModel.ProjectName;
				if (await DeployToGlitchUtils.ProjectExists(projectName))
				{
					GlitchProjectExists = true;
				}
				else GlitchProjectExists = false;

				var res = await WebHelper.IsRespondingWithStatus(DeployToGlitchUtils.GetProjectUrl(glitchModel.ProjectName), cancel);
				if (!res.success)
				{
					isWaitingForResponseFromGlitch = false;
					GlitchProjectIsResponding = false;
					if (!res.isCertificateError)
					{
						if (id != requestId) return;
						await Task.Delay(500, cancel);
						if (!cancel.IsCancellationRequested)
							UpdateGlitchProjectExists(glitchModel, cancel);
					}
				}
				else
				{
					GlitchProjectIsResponding = true;
				}
			}
			catch (TaskCanceledException)
			{
				// ignore
				requestedUpdate = false;
			}
			finally
			{
				isWaitingForResponseFromGlitch = false;
			}

			if (requestedUpdate) UpdateGlitchProjectExists(glitchModel, cancel);
		}
	}
}