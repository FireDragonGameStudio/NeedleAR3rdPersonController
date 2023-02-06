// #define NEEDLE_DEV

using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Needle.Engine
{
	internal static class Analytics
	{
		private const string endpoint = "https://urls.needle.tools/analytics-endpoint";

		private static string apiUrl;
		private static readonly HttpClient client = new HttpClient();

#if NEEDLE_DEV
		[UnityEditor.MenuItem(Constants.MenuItemRoot + "/Internal/Analytics/Register Installation")]
		private static void InternalRegisterInstallation() => RegisterInstallation();

		[UnityEditor.MenuItem(Constants.MenuItemRoot + "/Internal/Analytics/Register New Project")]
		private static void InternalRegisterNewProject() => RegisterNewProject("Analytics Debug Project", "Analytics Project Template");
#endif

		public static async void RegisterInstallation()
		{
			var url = await GetUrl();
			if (string.IsNullOrWhiteSpace(url)) return;
			url += "/api/v1/register/installation";
			var model = new UserEditorModel();
			Send(model, url);
		}

		public static async void RegisterNewProject(string projectName, string templateName)
		{
			var url = await GetUrl();
			if (string.IsNullOrWhiteSpace(url)) return;
			url += "/api/v1/register/new/project";
			projectName = UserCreatedProjectFromTemplateModel.AnonymizeProjectName(projectName);
			var model = new UserCreatedProjectFromTemplateModel(projectName, templateName);
			Send(model, url);
		}

		private static async void Send(object model, string url)
		{
			try
			{
				var data = JsonConvert.SerializeObject(model);
				var res = await client.PostAsync(url, new StringContent(data));
				var str = await res.Content.ReadAsStringAsync();
#if NEEDLE_DEV
				if (res.IsSuccessStatusCode)
				{
					
				}
#endif
			}
			catch (Exception)
			{
				// ignore
			}
		}

		private static async Task<string> GetUrl()
		{
			try
			{
				if (apiUrl != null) return apiUrl;
				var res = await client.GetAsync(endpoint);
				if (res.StatusCode == HttpStatusCode.OK)
				{
					apiUrl = await res.Content.ReadAsStringAsync();
					return apiUrl = apiUrl.Trim();
				}
			}
			catch (Exception)
			{
				// ignore
			}

			apiUrl = "";
			return null;
		}
	}
}