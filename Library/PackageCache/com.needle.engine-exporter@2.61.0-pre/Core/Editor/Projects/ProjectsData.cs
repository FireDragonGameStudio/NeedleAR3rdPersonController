using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine.Projects
{
	[FilePath("ProjectSettings/NeedleExporterSceneData.asset", FilePathAttribute.Location.ProjectFolder)]
	public class ProjectsData : ScriptableSingleton<ProjectsData>
	{
		[Serializable]
		public class SceneInfo
		{
			public string Path;
			public List<ProjectInfo> Projects = new List<ProjectInfo>();
			/// <summary>
			/// Guid of the scene.
			/// </summary>
			public string BuilderScene;
		}

		[Serializable]
		public class ProjectInfo
		{
			public string ProjectPath;

			public string FullPath => ExportInfo.GetFullPath(ProjectPath);
			public string PackageJsonPath => FullPath + "/package.json";
			
			public FileInfo VSCodeWorkspace => new DirectoryInfo(FullPath).EnumerateFiles("*.code-workspace").FirstOrDefault();

			public bool Exists => Directory.Exists(FullPath);
		}

		/// <summary>
		/// Contains projects used in scenes
		/// </summary>
		public List<SceneInfo> Scenes = new List<SceneInfo>();
		/// <summary>
		 /// Contains all projects
		 /// </summary>
		public List<ProjectInfo> Projects = new List<ProjectInfo>();

		public static bool TryGetForActiveScene(out SceneInfo info)
		{
			var act = SceneManager.GetActiveScene();
			return TryGetScene(act.path, out info);
		}

		public static bool TryGetScene(string scenePath, out SceneInfo info)
		{
			if (!instance)
			{
				info = null;
				return false;
			}
			info = instance.Scenes.FirstOrDefault(s => s.Path == scenePath);
			return info != null;
		}

		public static bool TryGetBuilderProjectInfo(out ProjectInfo proj)
		{
			proj = null;
			if (TryGetForActiveScene(out var si))
			{
				if (string.IsNullOrEmpty(si.BuilderScene))
				{
					return false;
				}
				var path = AssetDatabase.GUIDToAssetPath(si.BuilderScene);
				if (TryGetScene(path, out var builderInfo))
				{
					proj = builderInfo.Projects.FirstOrDefault();
					return proj != null;
				}
			}
			return false;
		}

		public static IEnumerable<ProjectInfo> EnumerateProjects()
		{
			if (!instance) yield break;
			foreach (var scene in instance.Projects)
			{
				yield return scene;
			}
		}

		internal void Save()
		{
			Undo.RegisterCompleteObjectUndo(this, "Save Needle Scene Data");
			base.Save(true);
		}
	}

	internal static class SceneDataLoader
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			// this is not called when a scene is renamed
			EditorSceneManager.sceneSaved += OnUpdateScene;
		}

		private static void OnUpdateScene(Scene scene)
		{
			if (!scene.IsValid()) return;
			if (scene.path.StartsWith("SceneTemplates/")) return;
			var projectInfos = new List<ExportInfo>();
			foreach (var root in scene.GetRootGameObjects())
				FindExportInfos(root, projectInfos);

			var data = ProjectsData.instance;
			var dirty = false;
			for (var index = data.Scenes.Count - 1; index >= 0; index--)
			{
				var sceneInfo = data.Scenes[index];
				// if (projectInfos.Count == 0 && sceneInfo.Path == scene.path)
				// {
				// 	data.Scenes.RemoveAt(index);
				// 	dirty = true;
				// 	continue;
				// }
				if (!File.Exists(scene.path))
				{
					data.Scenes.RemoveAt(index);
					dirty = true;
					continue;
				}
				for (var i = sceneInfo.Projects.Count - 1; i >= 0; i--)
				{
					var proj = sceneInfo.Projects[i];
					if (!proj.Exists)
					{
						sceneInfo.Projects.RemoveAt(i);
						dirty = true;
					}
				}
			}
			for (var i = data.Projects.Count - 1; i >= 0; i--)
			{
				var proj = data.Projects[i];
				if (!proj.Exists)
				{
					data.Projects.RemoveAt(i);
					dirty = true;
				}
			}
			
			
			if (dirty) data.Save();

			// if (projectInfos.Count <= 0) return;

			if (!ProjectsData.TryGetScene(scene.path, out var sceneData))
			{
				sceneData = new ProjectsData.SceneInfo();
				data.Scenes.Add(sceneData);
				dirty = true;
			}
			sceneData.Path = scene.path;
			sceneData.Projects = new List<ProjectsData.ProjectInfo>();
			foreach (var exp in projectInfos)
			{
				var path = exp.GetProjectDirectory();
				if (Directory.Exists(path))
				{
					var proj = new ProjectsData.ProjectInfo();
					sceneData.Projects.Add(proj);
					proj.ProjectPath = PathUtils.MakeProjectRelative(exp.GetProjectDirectory(), false);
					dirty = true;
					if(!data.Projects.Any(p => p.ProjectPath == proj.ProjectPath))
						data.Projects.Add(proj);
				}
			}

			// var prev = data.Projects;
			// data.Projects = data.Projects.GroupBy(p => p.ProjectPath).Select(x => x.First()).ToList();
			// dirty = true;
			
			if (dirty) data.Save();
		}

		private static void FindExportInfos(GameObject go, List<ExportInfo> list, int level = 0)
		{
			if (go.TryGetComponent(out ExportInfo exp))
			{
				list.Add(exp);
			}

			if (++level >= 5) return;

			foreach (Transform ch in go.transform)
			{
				FindExportInfos(ch.gameObject, list, level);
			}
		}
	}
}