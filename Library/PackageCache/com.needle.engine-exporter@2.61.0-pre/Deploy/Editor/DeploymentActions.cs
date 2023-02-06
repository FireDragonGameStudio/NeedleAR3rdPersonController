using System;
using System.Net.Http;
using Needle.Engine.Core;
using UnityEngine;
using Task = System.Threading.Tasks.Task;

namespace Needle.Engine.Deployment
{
	public static class DeploymentActions
	{
		public static void OpenGlitchRemixTemplate()
		{
			Application.OpenURL(DeployToGlitchUtils.TemplateProjectUrl);
		}

		private class GlitchAnonymousResponse
		{
			public string persistentToken;
			public int id;
		}

		private class GlitchRemixResponse
		{
			public bool @private;
			public DateTime createdAt;
			public string id;
			public string domain;
			public string[] remixChain;
			public string baseId;
			public string description;
			public bool privacy;
		}

		public static async void RemixAndOpenGlitchTemplate(GlitchModel model)
		{
			if (model != null)
			{
				// if we have a model we can make the glitch api request to remix the template
				using var client = new HttpClient();
				// var body = new StringContent("");
				// var userUrl = "https://api.glitch.com/boot?latestProjectOnly=true";// 
				var projectExistsUrl = $"https://api.glitch.com/v1/projects/by/domain?domain={DeployToGlitchUtils.TemplateName}";
				var remixUrl = $"https://api.glitch.com/v1/projects/by/domain?domain={DeployToGlitchUtils.TemplateName}";
				var res = await client.GetAsync(remixUrl);
				// var authUrl = "https://api.glitch.com/v1/auth/authorizationToken";
				// var anonUrl = "https://api.glitch.com/v1/users/anon";
				// var res = await client.PostAsync(anonUrl, body);
				// if (res.IsSuccessStatusCode)
				// {
				// 	var content = await res.Content.ReadAsStringAsync();
				// 	var response = JsonUtility.FromJson<GlitchAnonymousResponse>(content);
				// 	if (!string.IsNullOrWhiteSpace(response.persistentToken))
				// 	{
				// 		client.DefaultRequestHeaders.Add("authorization", response.persistentToken);
				// 		res = await client.PostAsync(remixUrl, body);
				// 		if (res.IsSuccessStatusCode)
				// 		{
				// 			content = await res.Content.ReadAsStringAsync();
				// 			var remixResponse = JsonUtility.FromJson<GlitchRemixResponse>(content);
				// 			if (!string.IsNullOrWhiteSpace(remixResponse.domain))
				// 			{
				// 				model.ProjectName = remixResponse.domain;
				// 				DeploymentSecrets.TryAutomaticallyAssignDeployKeyIfNoneExistsYet(model);
				// 				return;
				// 			}
				// 		}
				// 	}
				// }
			}
			Application.OpenURL(DeployToGlitchUtils.TemplateRemixUrl);
		}

		public static async void BuildAndDeployAsync(string directory, string projectName, string secret, BuildContext buildContext, bool open = false)
		{
			if (await Actions.ExportAndBuild(buildContext))
			{
				await Task.Delay(2000);
				DeployAsync(directory, projectName, secret, buildContext, open);
			}
		}

		public static async void DeployAsync(string directory, string projectName, string secret, BuildContext buildContext, bool open = false)
		{
			// We dont want to run the full build command here because that will also invoke the copy files script which potentially will overwrite the files that are already compressed in dist and uncompressed in assets
			// if (buildContext.command == BuildContext.Command.PrepareDeploy)
			// {
			// 	if (!await Actions.BuildDist(buildContext))
			// 	{
			// 		Debug.LogError("Error preparing for distribution, please see console for more info");
			// 		return;
			// 	}
			// }
			
			var success = await DeployToGlitchUtils.Deploy(directory, projectName, secret);
			if (open && success)
			{
				await Task.Delay(2000);
				Application.OpenURL(DeployToGlitchUtils.GetProjectUrl(projectName));
			}
		}

		public static void OpenInBrowser(GlitchModel model)
		{
			Application.OpenURL(DeployToGlitchUtils.GetProjectUrl(model.ProjectName));
		}
	}
}