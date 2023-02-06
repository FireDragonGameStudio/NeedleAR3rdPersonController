using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.Serialization;
using Directory = UnityEngine.Windows.Directory;

namespace Needle.Engine
{
	public class CommandTesterWindow : EditorWindow
	{
		[MenuItem(Constants.MenuItemRoot + "/Internal/Command Tester")]
		private static void Open()
		{
			Create(null, null);
		}

		public static CommandTesterWindow Create(string cmd = null, string directory = null)
		{
			var window = CreateInstance<CommandTesterWindow>();
			window.Show();
			window.command = cmd;
			window.directory = directory;
			return window;
		}

		private void OnEnable()
		{
			titleContent = new GUIContent("Command Tester");
			minSize = new Vector2(400, 200);
		}

		[FormerlySerializedAs("cmd")] public string command;
		public string directory;

		private void OnGUI()
		{
			EditorGUILayout.LabelField("Command", EditorStyles.boldLabel);
			using (new GUILayout.HorizontalScope())
			{
				command = EditorGUILayout.TextField(command);
			}
			if (!string.IsNullOrWhiteSpace(command))
			{
				if(command.Length > 20)
					EditorGUILayout.HelpBox(command, MessageType.None);
			}
			else
			{
				EditorGUILayout.HelpBox("Enter a command to execute in the field above", MessageType.Warning);
			}

			using (new GUILayout.HorizontalScope())
			{
				directory = EditorGUILayout.TextField("Directory (optional)", directory);
				if (GUILayout.Button("Pick", GUILayout.Width(40)))
				{
					var sel = EditorUtility.OpenFolderPanel("Select directory", directory, "");
					if (!string.IsNullOrWhiteSpace(sel)) directory = sel;
				}
			}
			if (!string.IsNullOrWhiteSpace(directory))
			{
				EditorGUILayout.HelpBox(directory, Directory.Exists(directory) ? MessageType.None : MessageType.Warning);
			}

			GUILayout.Space(10);
			var canRun = !string.IsNullOrEmpty(command);
			if (!string.IsNullOrWhiteSpace(directory) && !System.IO.Directory.Exists(directory))
				canRun = false;
			using (new EditorGUI.DisabledScope(!canRun))
			{
				if (GUILayout.Button("Run in Unity"))
				{
					if (!string.IsNullOrEmpty(directory))
						directory = Path.GetFullPath(directory);
					RunCommand();
				}

				if (GUILayout.Button("Run External"))
				{
					if (!string.IsNullOrEmpty(directory))
						directory = Path.GetFullPath(directory);
					RunStandalone();
				}
			}
		}

		private async void RunCommand()
		{
			var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(30));
			Debug.Log("Running command:\n" + command + " \n\nin \"" + directory + "\"");
			var logPath = Path.GetFullPath(Application.dataPath + "/../Temp/command-window-log.txt");
			await ProcessHelper.RunCommand(command, directory, logPath, true, true, cancellationToken: cancel.Token);
			Debug.Log("Process finished or cancelled");
		}

		private void RunStandalone()
		{
			Debug.Log("Running command:\n" + command + " \n\nin \"" + directory + "\"");
			Task.Run(async () => { await ProcessHelper.RunCommand(command + " & pause", directory, null, false, false); });
		}
	}
}