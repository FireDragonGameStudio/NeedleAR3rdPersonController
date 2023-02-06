using System;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;


namespace Needle.Engine.Deployment
{
	[CustomEditor(typeof(FTPServer))]
	public class FTPServerEditor : Editor
	{
		private string password;
		private GUIStyle _urlStyle;

		private void OnEnable()
		{
			(target as FTPServer)!.TryGetKey(out var secretsKey);
			password = SecretsHelper.GetSecret(secretsKey);
		}

		private void OnDisable()
		{
			if ((target as FTPServer)!.TryGetKey(out var key))
				SecretsHelper.SetSecret(key, password.Trim());
		}

		public override void OnInspectorGUI()
		{
			base.OnInspectorGUI();

			var ftp = target as FTPServer;
			if (!ftp) return;

			var canEnterPassword = ftp.TryGetKey(out _);
			using (new EditorGUI.DisabledScope(!canEnterPassword))
			{
				var tooltip = !canEnterPassword
					? "Please enter both the server- and username before entering the password."
					: "Passwords are not serialized to the project.";

				if (Event.current.modifiers == EventModifiers.Alt)
					password = EditorGUILayout.TextField(new GUIContent("Password", tooltip), password);
				else
					password = EditorGUILayout.PasswordField(new GUIContent("Password", tooltip), password);
				if (canEnterPassword && string.IsNullOrWhiteSpace(password))
				{
					EditorGUILayout.Space(2);
					EditorGUILayout.HelpBox("Please enter your FTP password in the password field above", MessageType.Warning);
				}
			}


			EditorGUILayout.Space(5);
			EditorGUILayout.LabelField("Optional", EditorStyles.boldLabel);
			EditorGUILayout.HelpBox("Enter the url this FTP account is pointing to - this will add a button to the DeployToFTP component to open the website from the Editor", MessageType.None);
			using (new EditorGUILayout.HorizontalScope())
			{
				var url = ftp.RemoteUrl;
				ftp.RemoteUrl = EditorGUILayout.TextField(new GUIContent("Remote Url", "This is the FTP directory that the FTP username has access to"), url);
				using (new EditorGUI.DisabledScope(!ftp.RemoteUrlIsValid))
				{
					if (GUILayout.Button("Open", GUILayout.Width(40))) 
						Application.OpenURL(url);
				}
			}

			if (_urlStyle == null)
			{
				_urlStyle ??= new GUIStyle(EditorStyles.label);
				_urlStyle.wordWrap = true;
				_urlStyle.normal.textColor = Color.gray;
				_urlStyle.richText = true;
			}
			EditorGUILayout.SelectableLabel(ftp.RemoteUrl.AsLink(), _urlStyle);
		}
	}
}