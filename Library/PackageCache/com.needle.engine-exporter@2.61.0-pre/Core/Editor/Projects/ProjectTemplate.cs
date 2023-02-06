using System;
using System.IO;
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Projects
{
	[CreateAssetMenu(menuName = Constants.MenuItemRoot + "/Project Template", order = Constants.MenuItemOrder)]
	public class ProjectTemplate : ScriptableObject
	{
		[Info("Please put this file inside your Needle Engine project template. When creating a new project the content of that directory (and all sub-directories) will be copied.")]
		public int Priority = 0;

		public string Title = "";
		[Multiline(5)] 
		public string Description;

		public string DisplayName => string.IsNullOrWhiteSpace(Title) ? name : Title;
		public string[] Links;

		public string GetPath()
		{
			return Path.GetDirectoryName(AssetDatabase.GetAssetPath(this));
		}
		
		public string GetFullPath()
		{
			return Path.GetFullPath(Path.GetDirectoryName(AssetDatabase.GetAssetPath(this))!);
		}

		public bool HasPackageJson()
		{
			var path = GetPath();
			if (!File.Exists(path + "/package.json")) return false;
			return true;
		}
	}

	[CustomEditor(typeof(ProjectTemplate))]
	internal class ProjectTemplateEditor : Editor
	{
		private string directory;
		private FileSystemInfo[] fileSystemEntries;
		
		private void OnEnable()
		{
			directory = Path.GetDirectoryName(AssetDatabase.GetAssetPath(target));
			if (directory != null)
			{
				directory = Path.GetFullPath(directory);
				fileSystemEntries = new DirectoryInfo(directory).EnumerateFileSystemInfos().ToArray();
			}
			else fileSystemEntries = Array.Empty<FileSystemInfo>();
		}

		public override void OnInspectorGUI()
		{
			// ComponentEditorUtils.DrawDefaultInspectorWithoutScriptField(this.serializedObject);
			base.OnInspectorGUI();
			GUILayout.Space(5);
			if (directory != null)
			{
				EditorGUILayout.HelpBox(directory, MessageType.None);
				if (!File.Exists(directory + "/package.json"))
				{
					EditorGUILayout.HelpBox("Missing package.json", MessageType.Warning);
				}
				if (!File.Exists(directory + "/tsconfig.json"))
				{
					EditorGUILayout.HelpBox("Missing tsconfig.json", MessageType.Warning);
				}
			}
		}
	}
}