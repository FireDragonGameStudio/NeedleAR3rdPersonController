using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public class NpmLogCapture : IDisposable
	{
#if UNITY_EDITOR_WIN
		private static readonly string logsDirectory = Environment.ExpandEnvironmentVariables("%AppData%/../Local/npm-cache/_logs");
#else
		private static readonly string logsDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + "/.npm/_logs";
#endif

#if UNITY_EDITOR
		[MenuItem("Needle Engine/Internal/Show Last Npm Log", priority = 10_000)]
		private static void OpenNpmLogs()
		{
			if (!Directory.Exists(logsDirectory))
			{
				Debug.Log("Npm log directory does not exist: " + logsDirectory);
				return;
			}
			if (GetLastLogFileCreated(out var filePath, float.MaxValue))
			{
				Debug.Log("Showing " + filePath);
				// EditorUtility.OpenWithDefaultApp(filePath);
				EditorUtility.RevealInFinder(filePath);
				//UnityEditorInternal.InternalEditorUtility.OpenFileAtLineExternal(filePath, 0);
			}
			else Debug.Log("Could not find any npm log file in " + Path.GetFullPath(logsDirectory));
		}
#endif

		public static bool GetLastLogFileCreated(out string log, float maxAgeInSeconds = 2, List<string> logsWithinTimeRange = null)
		{
			if (!Directory.Exists(logsDirectory))
			{
				log = null;
				return false;
			}
			var newest = default(FileInfo);
			var start = DateTime.Now;
			foreach (var file in Directory.EnumerateFiles(logsDirectory))
			{
				var fi = new FileInfo(file);
				try
				{
					if ((fi.CreationTime - start).TotalSeconds < maxAgeInSeconds)
					{
						if (logsWithinTimeRange != null) logsWithinTimeRange.Add(file);
						if (newest != null && fi.CreationTime > newest.CreationTime) continue;
						newest = fi;
					}
				}
				catch (UnauthorizedAccessException)
				{
					// ignore
				}
			}
			if (newest != null)
			{
				log = newest.FullName;
				return true;
			}
			log = null;
			return false;
		}

		public static NpmLogCapture Create()
		{
			var logs = new NpmLogCapture();
			return logs;
		}

		private readonly FileSystemWatcher watcher = new FileSystemWatcher();

		public string LogFile { get; private set; }

		public NpmLogCapture Begin()
		{
			var path = logsDirectory;
			if (!Directory.Exists(path)) return this;
			watcher.Path = path;
			watcher.Filter = "*.log";
			watcher.Created += OnCreated;
			watcher.EnableRaisingEvents = true;
			return this;
		}

		public NpmLogCapture End()
		{
			if (watcher != null)
			{
				watcher.EnableRaisingEvents = false;
			}
			return this;
		}

		private void OnCreated(object sender, FileSystemEventArgs e)
		{
			LogFile = e.FullPath;
			End();
		}

		public void Dispose()
		{
			watcher?.Dispose();
		}
	}
}