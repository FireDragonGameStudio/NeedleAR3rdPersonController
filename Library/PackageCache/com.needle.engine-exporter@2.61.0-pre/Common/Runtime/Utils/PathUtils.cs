using System;
using System.IO;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class PathUtils
	{
		// https://stackoverflow.com/a/32428566
		public static string GetHomePath()
		{
			// Not in .NET 2.0
			// System.Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
			if (Environment.OSVersion.Platform == PlatformID.Unix)
				return Environment.GetEnvironmentVariable("HOME");

			return Environment.ExpandEnvironmentVariables("%HOMEDRIVE%%HOMEPATH%");
		}
		
		private static readonly Regex invalidFileNameChars = new Regex(@"[<>:""/\\|?*\x00-\x1F]");
		
		public static string ToFileName(this string path)
		{
			return invalidFileNameChars.Replace(path, " ");
		}
		
		public static string MakeProjectRelative(string path)
		{
			return MakeProjectRelative(path, false);
		}
		
		public static string MakeProjectRelative(string path, bool encoded)
		{
			return MakeRelative(Application.dataPath, path, encoded);
		}

		public static string MakeRelative(string relativeFrom, string path, bool encoded = false)
		{
			if (string.IsNullOrEmpty(path)) return path;
			// if we make a file relative we need to append a "/" to the root directory
			// we cannot check if the file exists tho because it might not exist yet
			var isFilePath = !string.IsNullOrEmpty(Path.GetExtension(path));
			if (isFilePath)
			{
				if (!relativeFrom.EndsWith("/") && !relativeFrom.EndsWith("\\")) 
					relativeFrom += "/";
			}
			var isHiddenDirectory = path.EndsWith("~");
			if (isHiddenDirectory) path = path.Substring(0, path.Length - 1);
			relativeFrom = Path.GetFullPath(relativeFrom);
			path = Path.GetFullPath(path);
			var res = new Uri(relativeFrom, UriKind.Absolute).MakeRelativeUri(new Uri(path)).ToString();
			if (isHiddenDirectory) res += "~";
			if (!encoded) res = res.Replace("%20", " ");
			return res;
		}

		public static string RelativeTo(this string path, string basePath, bool encoded = false)
		{
			return MakeRelative(basePath, path, encoded);
		}

#if UNITY_EDITOR
		public static string SelectPath(string title, string currentPath = null)
		{
			const string prevPathKey = "Needle_Three_PreviouslySelectedFolder";
			string folder = default;
			if (currentPath != null && Directory.Exists(currentPath)) folder = Path.GetFullPath(currentPath);
			else
			{
				folder = EditorPrefs.GetString(prevPathKey);
				if (folder == null || !Directory.Exists(folder)) folder = Application.dataPath;
			}
			var sel = EditorUtility.OpenFolderPanel(title, folder, "");
			EditorPrefs.SetString(prevPathKey, sel);
			return sel;
		}


		public static void AddContextMenu(Action<GenericMenu> onOpen)
		{
			if (Event.current.type == EventType.ContextClick)
			{
				var last = GUILayoutUtility.GetLastRect();
				if (last.Contains(Event.current.mousePosition))
				{
					var menu = new GenericMenu();
					onOpen(menu);
					menu.ShowAsContext();
				}
			}
		}
#endif
	}
}