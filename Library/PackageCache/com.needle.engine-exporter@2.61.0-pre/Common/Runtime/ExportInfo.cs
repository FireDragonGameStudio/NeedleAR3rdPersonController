using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine
{
	[HelpURL(Constants.DocumentationUrl)]
	[NeedleEngineIgnore]
	public class ExportInfo : MonoBehaviour, IProjectInfo
	{
		internal static event Action<IProjectInfo> RequestGeneratingTempProject;

		string IProjectInfo.ProjectDirectory => GetProjectDirectory();
		string IProjectInfo.AssetsDirectory => GetProjectDirectory() + "/assets";

		public static string GetFullPath(string directoryName) => Path.GetFullPath(Application.dataPath + "/../" + directoryName);

		[Tooltip("The relative path to your javascript project where the Unity scene will be exported to. To create a new project just enter a new path, select a template from and click \"Generate project\"")]
		public string DirectoryName = null;

		[Tooltip("Exporting on save when enabled, otherwise only via menu items or build")]
		public bool AutoExport = true;

		[SerializeField] public List<Dependency> Dependencies = new List<Dependency>();

		public string BasePath => _basePath ??= Application.dataPath + "/../";
		public string GetProjectDirectory() => BasePath + DirectoryName;
		public bool Exists() => !string.IsNullOrWhiteSpace(DirectoryName) && File.Exists(PackageJsonPath);

		public string PackageJsonPath => DirectoryName + "/package.json";

		public bool IsInstalled()
		{
			if (!Exists()) return false;
			var dir = ProjectInfo.GetNeedleEngineRuntimePackageDirectory(GetProjectDirectory());
			return !string.IsNullOrEmpty(dir) && Directory.Exists(dir);
		}

		/// <summary>
		/// a project is considered a temp project when it is in Library/
		/// </summary>
		public bool IsTempProject()
		{
			var dir = DirectoryName;
			if (dir == null) return false;
			if (dir.StartsWith("Library/")) return true;
			return false;
		}

		public bool IsValidDirectory()
		{
			return DirectoryName != null && !DirectoryName.StartsWith("Temp/") && !Path.IsPathRooted(DirectoryName) && !(DirectoryName.EndsWith("\\") || DirectoryName.EndsWith("/")) && !DirectoryName.StartsWith("Assets/") && !DirectoryName.StartsWith("Packages/");
		}

		private string _packageJsonPath;
		private static string _basePath;

		private void OnValidate()
		{
			_packageJsonPath = DirectoryName + "/package.json";

			if (DirectoryName == null || DirectoryName.Length <= 0)
			{
				CreateName(SceneManager.GetActiveScene());

				if (transform.childCount <= 0 && GetComponents<Component>().Length <= 2)
				{
					SetNameAndTag();
				}

				async void SetNameAndTag()
				{
					await Task.Yield();
					gameObject.name = "Export Info";
					// ReSharper disable once Unity.InefficientPropertyAccess
					gameObject.tag = "EditorOnly";
				}
			}

			for (var index = Dependencies.Count - 1; index >= 0; index--)
			{
				var dep = Dependencies[index];
				if (string.IsNullOrEmpty(dep.Name))
				{
					Dependencies.RemoveAt(index);
				}
			}
		}

		internal void RequestInstallationIfTempProjectAndNotExists()
		{
			var dir = DirectoryName;
			if (!string.IsNullOrEmpty(dir) && IsValidDirectory())
			{
				if (!IsInstalled() || !Directory.Exists(dir))
				{
					if (IsTempProject())
					{
						RequestGeneratingTempProject?.Invoke(this);
					}
				}
			}
		}

		internal void CreateName(Scene scene)
		{
			var projectName = scene.name;
			if (string.IsNullOrWhiteSpace(projectName)) projectName = "newProject";
			DirectoryName = "Needle/" + projectName;
		}

#if UNITY_EDITOR_WIN
		[ContextMenu("Open in commandline")]
		private void OpenCmdLine()
		{
			var dir = GetProjectDirectory();
			if (!Exists()) Debug.LogWarning("Project directory does not exist: " + dir);
			else
				ProcessUtils.OpenCommandLine(GetProjectDirectory());
		}

		[ContextMenu("Internal/Create Web Project Config")]
		private void CreateProjectConfig()
		{
			if (NeedleProjectConfig.TryCreate(this, out _, out var path))
			{
				EditorUtility.RevealInFinder(path);
			}
		}
#endif
	}
}