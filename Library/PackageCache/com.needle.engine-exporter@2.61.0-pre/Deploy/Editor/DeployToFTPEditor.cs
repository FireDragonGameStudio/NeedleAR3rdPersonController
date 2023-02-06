using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace Needle.Engine.Deployment
{
	[CustomEditor(typeof(DeployToFTP))]
	public class DeployToFTPEditor : Editor
	{
		private IProjectInfo project;
		private SerializedProperty settings, path;

		private void OnEnable()
		{
			project = ObjectUtils.FindObjectOfType<IProjectInfo>();
			path = serializedObject.FindProperty(nameof(DeployToFTP.Path));
			settings = serializedObject.FindProperty(nameof(DeployToFTP.FTPServer));
		}

		public override void OnInspectorGUI()
		{
			if (project == null)
			{
				EditorGUILayout.HelpBox("No project found - please add a " + nameof(ExportInfo) + " component to you scene", MessageType.Warning);
				return;
			}

			var ftp = target as DeployToFTP;
			if (!ftp)
			{
				base.OnInspectorGUI();
				return;
			}


			ftp.Path = ftp.Path?.TrimStart('.');
			if (string.IsNullOrWhiteSpace(ftp.Path)) ftp.Path = "/";

			var change = new EditorGUI.ChangeCheckScope();

			EditorGUILayout.LabelField("FTP", EditorStyles.boldLabel);

			using (new GUILayout.HorizontalScope())
			{
				EditorGUILayout.PropertyField(settings, new GUIContent("Server"));
				if (!settings.objectReferenceValue)
				{
					if (GUILayout.Button("Create", GUILayout.Width(50)))
					{
						var instance = CreateInstance<FTPServer>();
						AssetDatabase.CreateAsset(instance, "Assets/FTPServer.asset");
						settings.objectReferenceValue = instance;
						serializedObject.ApplyModifiedProperties();
					}
				}
			}

			var server = ftp.FTPServer;
			string key = default;
			if (server)
				server.TryGetKey(out key);
			var password = SecretsHelper.GetSecret(key);

			if (server)
				EditorGUILayout.PropertyField(path, new GUIContent("Path", "The path on the ftp server where you want to deploy your website to."));

			if (change.changed)
			{
				serializedObject.ApplyModifiedProperties();
			}

			var hasPassword = !string.IsNullOrWhiteSpace(password);
			var directory = Path.GetFullPath(project.ProjectDirectory) + "/dist";
			var canDeploy = server && hasPassword && Directory.Exists(directory);


			if (server)
			{
				if (string.IsNullOrWhiteSpace(server.Servername) || string.IsNullOrWhiteSpace(server.Username))
				{
					EditorGUILayout.Space(2);
					EditorGUILayout.HelpBox(
						"Please enter your FTP server, username and password to the FTP server settings. You can get this information from your web provider. Don't worry: your password is not saved with the project and will not be shared.",
						MessageType.Warning);
				}
			}
			else
			{
				EditorGUILayout.Space(2);
				EditorGUILayout.HelpBox("Assign or create a FTP server settings object", MessageType.Info);
			}

			EditorGUILayout.Space(5);

			if (!canDeploy)
			{
				if (!hasPassword)
					EditorGUILayout.HelpBox("Server configuration is missing a password", MessageType.None);
			}

			using (new EditorGUI.DisabledScope(!canDeploy))
			{
				using (new GUILayout.HorizontalScope())
				{
					var devBuild = NeedleEngineBuildOptions.DevelopmentBuild;
					if ((Event.current.modifiers & EventModifiers.Alt) != 0) devBuild = !devBuild;

					if (GUILayout.Button("Build & Deploy: " + (devBuild ? "Dev" : "Prod"), GUILayout.Height(30)))
					{
						HandleUpload(project, server!.Servername, server.Username, password, true, devBuild);
					}
					if (GUILayout.Button("Deploy Only", GUILayout.Height(30)))
					{
						HandleUpload(project, server!.Servername, server.Username, password, false, devBuild);
					}
				}
			}

			var hasRemoteUrl = server && server.RemoteUrlIsValid;
			if (hasRemoteUrl)
			{
				// using (new EditorGUI.DisabledScope(!hasRemoteUrl))
				if (GUILayout.Button(
					    new GUIContent("Open in Browser " + Constants.ExternalLinkChar), GUILayout.Height(30)))
				{
					Application.OpenURL(server.RemoteUrl + "/" + ftp.Path);
				}
			}
		}

		private Task<bool> currentTask;
		private CancellationTokenSource cancel;

		private async void HandleUpload(IProjectInfo projectInfo, string server, string username, string password, bool runBuild, bool devBuild)
		{
			var comp = target as DeployToFTP;
			if (!comp) return;

			var webUrl = "http://" + server;
			var serverResponse = await WebHelper.MakeHeaderOnlyRequest(webUrl);
			if (serverResponse.responseCode == 404)
			{
				Debug.LogError("Server not found: " + webUrl);
				return;
			}
			if (serverResponse.result == UnityWebRequest.Result.ConnectionError)
			{
				Debug.LogError("Could not connect to " + webUrl);
				return;
			}

			cancel?.Cancel();
			if (currentTask != null && currentTask.IsCompleted == false) await currentTask;
			const int maxUploadDurationInMilliseconds = 10 * 60 * 1000;
			cancel = new CancellationTokenSource(maxUploadDurationInMilliseconds);

			var progId = Progress.Start("FTP Upload", "", Progress.Options.Managed);
			Progress.RegisterCancelCallback(progId, () =>
			{
				if (!cancel.IsCancellationRequested)
				{
					Debug.Log("Cancelling FTP upload...");
					cancel.Cancel();
				}
				return true;
			});

			BuildContext buildContext;
			if (runBuild) buildContext = BuildContext.Distribution(!devBuild);
			else buildContext = BuildContext.PrepareDeploy;

			if (comp.FTPServer.RemoteUrlIsValid)
				buildContext.LiveUrl = comp.FTPServer.RemoteUrl + "/" + comp.Path;

			var distDirectory = projectInfo.ProjectDirectory + "/dist";
			var buildResult = false;
			var postBuildMessage = default(string);
			if (runBuild)
			{
				Progress.SetDescription(progId, "Export and Build");
				var dev = NeedleEngineBuildOptions.DevelopmentBuild;
				Debug.Log("<b>Begin building distribution</b>");
				currentTask = Actions.ExportAndBuild(buildContext);
				buildResult = await currentTask;
				postBuildMessage = "<b>Successfully built distribution</b>";
			}
			else
			{
				currentTask = Actions.ExportAndBuild(buildContext);
				buildResult = await currentTask;
			}

			if (cancel.IsCancellationRequested)
			{
				Debug.LogWarning("Upload cancelled");
				return;
			}
			if (!buildResult)
			{
				Debug.LogError("Build failed, aborting FTP upload - see console for errors");
				return;
			}
			if (postBuildMessage != null) Debug.Log(postBuildMessage);

			Debug.Log("<b>Begin uploading</b> " + distDirectory);
			Progress.SetDescription(progId, "Upload " + Path.GetDirectoryName(projectInfo.ProjectDirectory) + " to FTP");


			var serverName = SanitizeServerUrl(server.Trim());
			var opts = new DeployToFTPUtils.UploadContext(serverName, username, password, comp.Path, progId);
			opts.CancellationToken = cancel.Token;
			opts.DebugLog = true;
			currentTask = UploadDirectory(distDirectory, opts);
			var uploadResult = await currentTask;
			if (opts.IsCancelled())
				Debug.LogWarning("<b>FTP upload was cancelled</b>");
			else if (uploadResult)
			{
				Debug.Log($"<b>FTP upload {"succeeded".AsSuccess()}</b> " + distDirectory);
				if (!string.IsNullOrWhiteSpace(buildContext.LiveUrl))
					Application.OpenURL(buildContext.LiveUrl);
			}
			else Debug.LogError("Uploading failed. Please see console for errors.\n" + distDirectory);
			if (Progress.Exists(progId))
				Progress.Finish(progId);
		}

		protected virtual Task<bool> UploadDirectory(string directory, DeployToFTPUtils.UploadContext context)
		{
			return DeployToFTPUtils.StartUpload(directory, context);
		}

		protected virtual string SanitizeServerUrl(string serverName)
		{
			// TODO: proper sftp support etc
			if (!serverName.StartsWith("ftp://ftp") && !serverName.StartsWith("sftp://sftp"))
				serverName = "ftp://ftp." + serverName;
			return serverName;
		}
	}

	public static class DeployToFTPUtils
	{
		public class UploadContext
		{
			public readonly string Server;
			public readonly string Username;
			public readonly string Password;
			public readonly string Path;
			public readonly NetworkCredential Credentials;
			public readonly int ProgressId;

			public bool DebugLog = false;
			public CancellationToken CancellationToken;

			public UploadContext(string server, string username, string password, string path, int progressId)
			{
				this.Server = server;

				this.Username = username;
				this.Password = password;
				this.Path = path;
				this.Credentials = new NetworkCredential(username, password);
				this.ProgressId = progressId;
			}

			internal bool IsCancelled()
			{
				return CancellationToken.IsCancellationRequested;
			}
		}

		public static async Task<bool> StartUpload(string directory, UploadContext context)
		{
			if (!Directory.Exists(directory))
			{
				Debug.LogError("FTP upload failed, directory does not exist: " + directory);
				return false;
			}

			var path = context.Path.Trim();
			if (!path.StartsWith("/")) path = "/" + path;
			if (!path.EndsWith("/")) path += "/";

			using var client = new WebClient();
			client.Credentials = new NetworkCredential(context.Username, context.Password);
			await EnsureFolderExistsFullPath(client.Credentials, context.Server, path, context.CancellationToken);
			if (context.IsCancelled()) return false;
			var url = $"{context.Server}{path}";
			await UploadRecursive(client, url, directory, context, new List<Task>());
			client.Dispose();
			return !context.IsCancelled();
		}

		private static async Task UploadRecursive(WebClient client, string url, string directory, UploadContext context, List<Task> uploads)
		{
			if (!url.EndsWith("/")) url += "/";

			var files = Directory.EnumerateFiles(directory).ToArray();
			for (var index = 0; index < files.Length; index++)
			{
				if (context.IsCancelled()) break;
				var file = files[index];
				var fi = new FileInfo(file);
				var remotePath = url + fi.Name;
				if (context?.DebugLog ?? false)
				{
					var filesizeInMb = Mathf.CeilToInt(fi.Length / (float)(1024));
					Debug.Log($"Upload {filesizeInMb:0} kb: {fi.Name} at {fi.FullName}\n{remotePath}");
				}

				if (context.ProgressId > 0 && Progress.Exists(context.ProgressId))
				{
					Progress.Report(context.ProgressId, index, files.Length, "Uploading " + fi.Name);
				}

				var request = WebRequest.Create(remotePath);
				request.Credentials = context.Credentials;
				request.Method = WebRequestMethods.Ftp.UploadFile;

				using (Stream fileStream = File.OpenRead(file))
				using (var ftpStream = await request.GetRequestStreamAsync())
				{
					const int bufferSize = 1024 * 1024 + 5;
					await fileStream.CopyToAsync(ftpStream, bufferSize, context.CancellationToken);
					// explicitly dispose ftp stream to make sure connections are closed
					ftpStream.Dispose();
				}
				// uploads.Add(upload);
				// await client.UploadFileTaskAsync(remotePath, file);
			}
			// await Task.WhenAll(uploads);
			uploads.Clear();
			await Task.Yield();
			foreach (var dir in Directory.EnumerateDirectories(directory))
			{
				if (context.IsCancelled()) break;
				var dirName = new DirectoryInfo(dir).Name;
				var remoteDirectory = url + dirName;
				await EnsureFolderExists(client.Credentials, remoteDirectory);
				await UploadRecursive(client, remoteDirectory, dir, context, uploads);
			}
		}

		private static readonly char[] pathSegmentSeparators = { '/', '\\' };

		private static async Task EnsureFolderExistsFullPath(ICredentials credentials, string basePath, string path, CancellationToken cancel)
		{
			var segments = path.Split(pathSegmentSeparators, StringSplitOptions.RemoveEmptyEntries);
			foreach (var seg in segments)
			{
				if (cancel.IsCancellationRequested) return;
				basePath += "/" + seg;
				await EnsureFolderExists(credentials, basePath);
			}
		}

		private static async Task EnsureFolderExists(ICredentials credentials, string folderPath)
		{
			try
			{
				folderPath = folderPath.TrimEnd('/');
				var requestDir = WebRequest.Create(folderPath);
				requestDir.Method = WebRequestMethods.Ftp.MakeDirectory;
				requestDir.Credentials = credentials;
				(await requestDir.GetResponseAsync()).Close();
			}
			catch (WebException ex)
			{
				// if the directory already exists we handle the error here
				var name = folderPath.Substring(folderPath.LastIndexOfAny(pathSegmentSeparators) + 1);
				if (ex.Message.StartsWith("Server returned an error: 550 " + name))
				{
				}
				else Debug.LogException(ex);
			}
		}

		private static bool CheckFTPConnection(string url, NetworkCredential credentials)
		{
			Uri siteUri = new Uri(url);
			FtpWebRequest request = (FtpWebRequest)WebRequest.Create(siteUri);
			request.Credentials = credentials;
			request.Method = WebRequestMethods.Ftp.GetDateTimestamp;
			request.UsePassive = true;
			request.UseBinary = true;
			request.KeepAlive = false;
			try
			{
				request.GetResponse();
				return true;
			}
			catch (WebException e)
			{
				if (e.Status == WebExceptionStatus.ProtocolError)
				{
					return true;
				}
				return false;
			}
		}
	}
}