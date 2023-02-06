using System;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.Networking;

namespace Needle.Engine.Deployment
{
	public static class DeploymentSecrets
	{
		public static string GetGlitchDeploymentKey(string projectName)
		{
			return EditorPrefs.GetString(projectName + "_DEPLOYMENT_KEY", string.Empty);
		}

		public static void SetGlitchDeploymentKey(string projectName, string key)
		{
			EditorPrefs.SetString(projectName + "_DEPLOYMENT_KEY", key);
		}


		internal static bool IsCurrentlyRequestingDeployKey => isCurrentlyAssigningDeployKey && (DateTime.Now - DeployRequestTime).TotalMilliseconds > 1000;
		internal static DateTime DeployRequestTime { get; private set; }
		
		private static bool isCurrentlyAssigningDeployKey;
		private static int requestId;
		
		private static readonly string[] progressDescriptions = new[]
		{
			"Requesting deploy key...",
			"Glitch is waking up...",
			"Don't worry, so far this is all normal.",
			"Almost there! Go Glitch!",
			"I'm beginning to worry... what is taking so long...",
			"Still ok! We're getting there",
			"Yo can you check if you entered the correct glitch name???",
			"Still waiting for a deploy key",
			"Waiting for Glitch..."
		};

		internal static async void TryAutomaticallyAssignDeployKeyIfNoneExistsYet(GlitchModel model, int maxRetries = 20, bool force = false)
		{
			if (model == null || string.IsNullOrEmpty(model.ProjectName) || !string.IsNullOrWhiteSpace(GetGlitchDeploymentKey(model.ProjectName)))
				return;
			// dont make too many requests
			if (!force && (DateTime.Now - DeployRequestTime).TotalSeconds < 5) return;
			if (isCurrentlyAssigningDeployKey) return;
			isCurrentlyAssigningDeployKey = true;
			int progressId = -1;
			var id = ++requestId;
			try
			{
				DeployRequestTime = DateTime.Now;
				StartProgressDelayed();
				await InternalLoop();
			}
			finally
			{
				Progress.Finish(progressId);
				isCurrentlyAssigningDeployKey = false;
			}

			async void StartProgressDelayed()
			{
				await Task.Delay(1000);
				if (isCurrentlyAssigningDeployKey && id == requestId)
					progressId = Progress.Start("Glitch", "Request glitch deploy key", Progress.Options.Indefinite | Progress.Options.Managed);
			}

			string GetDescription(int retry)
			{
				if (progressDescriptions == null) return "";
				return progressDescriptions[Mathf.Clamp(retry, 0, progressDescriptions.Length - 1)];
			}

			async Task InternalLoop()
			{
				var descriptionIndex = 0;
				var descriptionChangeCounter = 0f;
				var dt =  1 / 120f;
				for (var i = 0; i < maxRetries; i++)
				{
					var projectName = model.ProjectName;
					if (string.IsNullOrEmpty(projectName)) return;
					if (DeploymentUtils.GlitchProjectExists == false) return;
					// var urlName = HttpUtility.UrlPathEncode(projectName);
					var url = "https://" + projectName + ".glitch.me/v1/deploy/generate-key";
					 var formData = new WWWForm();
					var req = UnityWebRequest.Post(url, formData);
					var op = req.SendWebRequest();
					var desc = GetDescription(descriptionIndex++);
					while (!op.isDone)
					{
						await Task.Yield();
						if (Progress.Exists(progressId))
						{
							Progress.Report(progressId, i / (float)maxRetries, desc);
							descriptionChangeCounter += dt;
							if (descriptionChangeCounter > 5)
							{
								descriptionChangeCounter = 0;
								desc = GetDescription(++descriptionIndex);
							}
						}
					}
					var res = op.webRequest.result;
					switch (req.responseCode)
					{
						case 401:
							return;
						case 404:
						case 500:
							if (!string.IsNullOrEmpty(req.downloadHandler.error))
								Debug.LogWarning("Failed automatically assigning glitch secret: " + req.downloadHandler.error);
							return;
					}
					switch (res)
					{
						case UnityWebRequest.Result.Success:
							var secret = req.downloadHandler.text;
							Debug.Log("<b>Generated deployment secret</b> for: " + projectName + "! You are now ready to upload your project to Glitch <3\n<i>" + secret + "</i>");
							SetGlitchDeploymentKey(projectName, secret);
							InternalEditorUtility.RepaintAllViews();
							return;
					}
					await Task.Delay(4000);
				}
			}
		}
	}
}