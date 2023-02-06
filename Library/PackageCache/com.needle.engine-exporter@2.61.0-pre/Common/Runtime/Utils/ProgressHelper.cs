
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Utils
{
	
#if UNITY_EDITOR
	internal static class ProgressHelper
	{
		private const string stateName = "Needle.Engine.Processes.Info";
		
		public static IEnumerable<Process> GetStartedAndRunningProcesses(Predicate<StartedProcessInfos> returnIfTrue = null)
		{
			var list = GetStartedProcessInfos() as IEnumerable<StartedProcessInfos>;
			if (returnIfTrue != null && list != null) list = list.Where(e => returnIfTrue(e));
			return list?.Select(e =>
			{
				try
				{
					return Process.GetProcessById(e.processId);
				}
				catch (ArgumentException)
				{
					// if progress has exited...
					return null;
				}
			}).Where(p => p != null && p.HasExited == false);
		}
		
		public static IList<StartedProcessInfos> GetStartedProcessInfos()
		{
			List<StartedProcessInfos> list;
			var json = SessionState.GetString(stateName, "");
			if (string.IsNullOrEmpty(json)) list = new List<StartedProcessInfos>();
			else list = JsonConvert.DeserializeObject<List<StartedProcessInfos>>(json);
			if (list == null) return null;
			return list;
		}

		private static DateTime _recompileTime;

		[InitializeOnLoadMethod]
		private static async void Init()
		{
			EditorApplication.quitting += OnQuit;
			_recompileTime = DateTime.Now;
			await Task.Delay(100);
			ValidateAndUpdateStartedProcesses();
		}

		private static void OnQuit()
		{
			// ProcessUtils.KillNodeProcesses(cmd => EditorUtility.DisplayDialog("Quit running servers", "Do you want to quit running tiny servers? (" + cmd + ")", "Yes", "No dont kill"));
		}

		[Serializable]
		internal class StartedProcessInfos
		{
			public int processId;
			public string command;
			public int unityProgressId;
			public string progressName;
			public string description;
			public string projectDirectory;
			public string unityProjectName;

			public bool IsInstallation() => command.Contains("npm install");
			public bool IsThisProject() => new DirectoryInfo(Application.dataPath).Parent!.Name == unityProjectName;

			public StartedProcessInfos(int processId, string command, int unityProgressId, string progressName, string description, string projectDir)
			{
				this.processId = processId;
				this.command = command;
				this.unityProgressId = unityProgressId;
				this.progressName = progressName;
				this.description = description;
				this.projectDirectory = projectDir;
				this.unityProjectName = new DirectoryInfo(Application.dataPath).Parent!.Name;
			}
		}

		internal static void SaveStartedProcess(int id, string command, int unityProgressId, string progressName, string description, string projectDir)
		{
			List<StartedProcessInfos> list;
			var json = SessionState.GetString(stateName, "");
			if (string.IsNullOrEmpty(json)) list = new List<StartedProcessInfos>();
			else list = JsonConvert.DeserializeObject<List<StartedProcessInfos>>(json);
			var newEntry = new StartedProcessInfos(id, command, unityProgressId, progressName, description, projectDir);
			list ??= new List<StartedProcessInfos>();
			list.Add(newEntry);
			json = JsonConvert.SerializeObject(list);
			SessionState.SetString("Needle.Engine.Processes.Info", json);
		}

		internal static void UpdateStartedProcessesList() => ValidateAndUpdateStartedProcesses();

		private static void ValidateAndUpdateStartedProcesses()
		{
			List<StartedProcessInfos> list;
			var json = SessionState.GetString(stateName, "");
			if (string.IsNullOrEmpty(json)) list = new List<StartedProcessInfos>();
			else list = JsonConvert.DeserializeObject<List<StartedProcessInfos>>(json);
			for (var index = list.Count - 1; index >= 0; index--)
			{
				var e = list[index];
				try
				{
					var prog = Process.GetProcessById(e.processId); 
					if ((bool)prog?.HasExited)
					{
						list.RemoveAt(index);
					}
					else
					{
						if (Progress.Exists(e.unityProgressId))
							Progress.Remove(e.unityProgressId);
						var progressId = Progress.Start(e.progressName, e.description, Progress.Options.Indefinite | Progress.Options.Unmanaged);
						e.unityProgressId = progressId;
						RegisterCancelCallback(progressId, new TaskProcessInfo(e.projectDirectory, e.command));
						ProcessHelper.PingUnityBackgroundProgress(prog, e.unityProgressId, e.IsInstallation());
					}
				}
				catch (ArgumentException)
				{
					// ignore cant find process
					if (Progress.Exists(e.unityProgressId))
						Progress.Remove(e.unityProgressId);
					list.RemoveAt(index);
				}
			}
			json = JsonConvert.SerializeObject(list);
			SessionState.SetString(stateName, json);
		}

		internal static void RegisterCancelCallback(int id, TaskProcessInfo info)
		{
			Progress.RegisterCancelCallback(id, () =>
			{
				// cancel callback is also called on recompile (when type is managed)
				if (Progress.Exists(id))
				{
					if (!EditorApplication.isCompiling &&
					    !EditorApplication.isUpdating && !EditorApplication.isPlayingOrWillChangePlaymode &&
					    !EditorApplication.isTemporaryProject && DateTime.Now - _recompileTime > TimeSpan.FromSeconds(1))
					{
						ProcessHelper.CancelTask(info);
						return true;
					}
				}
				Debug.LogWarning("Sorry could not cancel process: " + info.Cmd);
				return false;
			});
		}
	}
#endif
}