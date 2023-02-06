using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using Unity.SharpZipLib.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace Needle.Engine.Deployment
{
	public static class DeployToGlitchUtils
	{
		public const string TemplateName = "needle-tiny-starter";
		public const string TemplateUrl = @"https://" + TemplateName + ".glitch.me";

		public const string TemplateProjectUrl = "https://glitch.com/~" + TemplateName;
		public const string TemplateRemixUrl = "https://glitch.com/edit/#!/remix/" + TemplateName;
		// private const string RemixEndpoint = "https://api.glitch.com/v1/projects/" + TemplateName + "/remix";

		private static DateTime _lastTimeNameResolutionFailureOccured;

		public static async Task<bool> ProjectExists(string projectName)
		{
			using var client = new HttpClient();
			var url = $"https://api.glitch.com/v1/projects/by/domain?domain={projectName}";
			try
			{
				var res = await client.GetAsync(url);
				if (res.StatusCode != HttpStatusCode.OK) return false;
				var content = await res.Content.ReadAsStringAsync();
				return !string.IsNullOrWhiteSpace(content) && content.Contains(projectName);
			}
			catch (HttpRequestException ex)
			{
				if (ex.InnerException is WebException webException && webException.Message == "Error: NameResolutionFailure")
				{
					var now = DateTime.Now;
					if ((now - _lastTimeNameResolutionFailureOccured).TotalMinutes > 1)
					{
						_lastTimeNameResolutionFailureOccured = now;
						Debug.LogError("Looks like you're offline: please check your internet connection\n\n" + ex);
					}
					return false;
				}
				Debug.LogException(ex);
				return false;
			}
		}

		private static DateTime _lastProjectUrlContainsSpacesErrorMessage;
		public static string GetProjectUrl(string projectName)
		{
			projectName = projectName.Trim();
			if (projectName.Contains(" "))
			{
				if(DateTime.Now - _lastProjectUrlContainsSpacesErrorMessage > TimeSpan.FromSeconds(30))
				{
					_lastProjectUrlContainsSpacesErrorMessage = DateTime.Now;
					Debug.LogError("Glitch Project name cannot contain spaces. Please remove them and try again: \"" + projectName + "\"");
				}
				return null;
			}
#if UNITY_EDITOR
			if (Unsupported.IsDeveloperMode() && projectName.Contains("http")) return projectName;
#endif
			return $@"https://{projectName}.glitch.me";
		}

		public static string GetEditUrl(string projectName, string fileName = null)
		{
			var url = $"https://glitch.com/edit/#!/{projectName}";
			if (!string.IsNullOrEmpty(fileName))
				url += "?path=" + Uri.EscapeUriString(fileName);
			return url;
		}

		private static Task<bool> deployTask;
		private static CancellationTokenSource deployTaskCancelToken;

		public static bool IsCurrentlyDeploying => deployTask != null && deployTask.IsCompleted == false;

		public static void CancelCurrentDeployment() => deployTaskCancelToken.Cancel();

		public static Task<bool> Deploy(string folder, string projectName, string secret, CancellationTokenSource cancelSource = default)
		{
			if (IsCurrentlyDeploying)
			{
				Debug.Log("Deploy of " + projectName + " already in progress...");
				return deployTask;
			}
			cancelSource ??= new CancellationTokenSource();
			var cancelToken = cancelSource.Token;
			var task = InternalDeploy(folder, projectName, secret, cancelToken);
			deployTask = task;
			deployTaskCancelToken = cancelSource;
			return task;
		}

		private static async Task<bool> InternalDeploy(string folder, string projectName, string secret, CancellationToken cancel)
		{
			bool CheckCancelled()
			{
				if (cancel.IsCancellationRequested)
				{
					Debug.Log("Deploy cancelled");
					return true;
				}
				return false;
			}

			if (string.IsNullOrEmpty(secret))
			{
				Debug.LogError("Can not deploy to glitch without deployment secret!");
				return false;
			}
			
			if (!Directory.Exists(folder))
			{
				Debug.LogError("Deploy folder does not exist, did you install and build your project properly?\n" + folder);
				return false;
			}
			
			var serverUrl = GetProjectUrl(projectName);
			var endpoint = serverUrl + "/v1/deploy";
			if (!await WebHelper.IsResponding(endpoint, cancel))
			{
				Debug.LogError("Glitch server is not responding, is the server url correct and does the endpoint exist: " + endpoint);
				return false;
			}
			Debug.Log("Begin deploying " + Path.GetFullPath(folder).AsLink() + " to " + projectName);
			var outputPath = Application.dataPath + "/../Temp/glitch.zip";
			if (File.Exists(outputPath)) File.Delete(outputPath);
			ZipUtility.CompressFolderToZip(outputPath, null, folder);
			if (CheckCancelled()) return false;

			if (!File.Exists(outputPath))
			{
				Debug.LogError("Failed zipping " + folder);
				return false;
			}


			var form = new WWWForm();
			// form.headers.Add("deployment_key", secret);
			var bytes = File.ReadAllBytes(outputPath);
			form.AddBinaryData("zip", bytes);

			var urlString = "<a href=\"" + serverUrl + "\">" + serverUrl + "</a>";
			var sizeInMb = bytes.Length / (1024f * 1024);
			var uncompressedSize = FileUtils.GetTotalSize(new DirectoryInfo(folder)) / (1024f * 1024);
			Debug.Log($"Uploading {sizeInMb:0.0} mb (uncompressed: {uncompressedSize:0.0} mb) to {urlString}\nEndpoint: " + serverUrl);
			if (sizeInMb > 250)
			{
				Debug.LogWarning("Glitch free storage is limited to 200 mb. Unless you have your project boosted this upload will fail. Please see " + "https://help.glitch.com/kb/article/101-disk-space-warning/".AsLink());
			}
			var req = UnityWebRequest.Post(endpoint, form);
			req.SetRequestHeader("deployment_key", secret);
			req.SetRequestHeader("zip_length", bytes.Length.ToString());
			var op = req.SendWebRequest();
#if UNITY_EDITOR
			var id = Progress.Start("Upload " + projectName, $"Uploading {sizeInMb:0.0} mb to glitch", Progress.Options.Managed);
			Progress.RegisterCancelCallback(id, () =>
			{
				if (!req.isDone)
					req.Abort();
				return true;
			});
#endif
			var lastLog = DateTime.Now;
			var startTime = DateTime.Now;
#if UNITY_EDITOR
			var secondsToWait = 1f;
#endif
			while (!op.isDone)
			{
				await Task.Delay(200, cancel);
				if (CheckCancelled())
				{
					if(!req.isDone) req.Abort();
					return false;
				}
#if UNITY_EDITOR
				if (Progress.GetStatus(id) == Progress.Status.Canceled)
				{
					break;
				}
				Progress.Report(id, req.uploadProgress);
				if ((DateTime.Now - lastLog).TotalSeconds > secondsToWait)
				{
					if(secondsToWait < 3f)
						secondsToWait *= 1.3f;
					lastLog = DateTime.Now;
					
					var timeRemaining = TimeHelper.CalculateTimeRemaining(startTime, sizeInMb, sizeInMb * req.uploadProgress);
					Debug.Log($"<b>{(req.uploadProgress * 100):0} %</b> → approx. {timeRemaining:mm':'ss} until done");
				}
#endif
			}
#if UNITY_EDITOR
			Progress.Finish(id, req.result == UnityWebRequest.Result.Success ? Progress.Status.Succeeded : Progress.Status.Failed);
#endif

			if (req.result == UnityWebRequest.Result.Success)
			{
				var totalTime = DateTime.Now - startTime;
				Debug.Log($"<b>Successfully deployed</b> to {urlString} in {totalTime:mm':'ss}");
			}
			else
			{
				var msg = !string.IsNullOrWhiteSpace(req.downloadHandler.text) ? req.downloadHandler.text : req.error;
				if (req.responseCode == 401 || msg.Contains("Well, you found a glitch.") || req.responseCode == 404)
				{
					Debug.LogError(
						$"Upload failed - are you sure {urlString} exists? Maybe the name is incorrect or the project is private? Code:  {req.responseCode}\nOriginal error:\n{msg}");
				}
				else if (req.responseCode == 503)
				{
					// site didnt respond, probably because user changes some script or server restarted
					Debug.LogError("Upload failed - probably someone changed a file on glitch and your server restarted!?\n" + msg);
				}
				else if (req.responseCode == 405)
				{
					// no POST request available, probably an existing Glitch page but remixed from something else
					Debug.LogError($"Upload failed - looks like the server does not accept POST requests. Are you sure you remixed from {TemplateName} ({TemplateProjectUrl})?\n{msg}");
				}
				else
				{
					Debug.LogError("Upload failed: " + msg);
				}
			}
			return req.result == UnityWebRequest.Result.Success;
		}

		private static void ReportUploadProgress(UnityWebRequestAsyncOperation op, int id)
		{
#if UNITY_EDITOR
			Progress.Report(id, op.progress);
#endif
		}

		// [MenuItem("Test/ZipFolder")]
		// private static void TestZip()
		// {
		// 	var d = new DeployToGlitch();
		// 	d.Deploy(@"C:\git\needle-tiny-playground\projects\Unity-Threejs_2020_3\myProject\dist");
		// }

		// public async Task<bool> CreateNewProject()
		// {
		// 	var req = UnityWebRequest.Post(RemixEndpoint, "");
		// 	req.SendWebRequest();
		// 	while (!req.isDone) await Task.Delay(5);
		// 	if (req.result == UnityWebRequest.Result.Success)
		// 		Debug.Log("Uploading successfully done");
		// 	else
		// 		Debug.LogError("Upload failed: " + req.error);
		// 	return req.result == UnityWebRequest.Result.Success;
		// }

		// [MenuItem("Test/Remix")]
		// private static void TestRemix()
		// {
		// 	var d = new DeployToGlitch();
		// 	d.CreateNewProject();
		// }
	}
}