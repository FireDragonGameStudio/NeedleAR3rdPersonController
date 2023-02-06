using System.IO;
using Needle.Engine.Editors;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Projects
{
	[CustomEditor(typeof(SceneAsset))]
	public class SceneEditor : Editor
	{
		private string path;

		private void OnEnable()
		{
			path = AssetDatabase.GetAssetPath(target);
			asset = null;
			if (ProjectsData.TryGetScene(path, out var sceneInfo))
			{
				if (!string.IsNullOrEmpty(sceneInfo.BuilderScene))
				{
					var scenePath = AssetDatabase.GUIDToAssetPath(sceneInfo.BuilderScene);
					asset = AssetDatabase.LoadAssetAtPath<SceneAsset>(scenePath);
				}
			}
		}

		private Vector2 scroll;
		private SceneAsset asset;

		public override void OnInspectorGUI()
		{
			scroll = EditorGUILayout.BeginScrollView(scroll);
			base.OnInspectorGUI();

			var sceneAsset = target as SceneAsset;
			try
			{
				GUILayout.Space(5);
				EditorGUI.indentLevel += 1;
				GUI.enabled = true;

				var data = ProjectsData.instance;
				var dirty = false;
				if (ProjectsData.TryGetScene(path, out var sceneInfo))
				{
					var hasProjects = sceneInfo.Projects.Count > 0;

					// using (var scope = new EditorGUI.ChangeCheckScope())
					// {
					// 	EditorGUILayout.LabelField("Experimental", EditorStyles.boldLabel);
					// 	var tooltip = asset
					// 		? $"The scene {sceneAsset?.name} will be exported to a web project in \"{asset.name}\" on save."
					// 		: $"Assign a scene containing a web project to automatically export {sceneAsset?.name} to it on save.";
					// 	asset = EditorGUILayout.ObjectField(new GUIContent("Project Scene", tooltip), asset, typeof(SceneAsset), false) as SceneAsset;
					// 	EditorGUILayout.HelpBox(tooltip, MessageType.None);
					// 	if (scope.changed)
					// 	{
					// 		if (!asset) sceneInfo.BuilderScene = null;
					// 		else sceneInfo.BuilderScene = AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(asset));
					// 		ProjectsData.instance.Save();
					// 	}
					// 	if (hasProjects) GUILayout.Space(10);
					// }

					if (hasProjects)
					{
						EditorGUILayout.LabelField("Projects used in this scene", EditorStyles.boldLabel);
						for (var index = 0; index < sceneInfo.Projects.Count; index++)
						{
							var proj = sceneInfo.Projects[index];
							// if (!Directory.Exists(proj.ProjectPath))
							// {
							// 	sceneInfo.Projects.RemoveAt(index--);
							// 	dirty = true;
							// 	continue;
							// }
							using (new GUILayout.HorizontalScope())
							{
								EditorGUILayout.LabelField(proj.ProjectPath);
								GUILayout.FlexibleSpace();
								if (GUILayout.Button(new GUIContent("Show", "Open directory in explorer/finder")))
								{
									EditorUtility.RevealInFinder(proj.PackageJsonPath);
								}
								GUILayout.Space(2);
							}

							using (new GUILayout.HorizontalScope())
							{
								GUILayout.FlexibleSpace();
								if (ExportInfoEditor.TryGetVsCodeWorkspacePath(proj.ProjectPath, out var workspacePath))
								{
									if (GUILayout.Button("VS Workspace ↗"))
									{
										EditorUtility.OpenWithDefaultApp(workspacePath);
										GUIUtility.ExitGUI();
									}
								}
								ExportInfoEditor.DrawStartServerButtons(Path.GetFullPath(proj.ProjectPath));
							}

							var packageJsonPath = proj.ProjectPath + "/package.json";
							if (!File.Exists(packageJsonPath))
							{
								EditorGUILayout.HelpBox("Missing package.json!", MessageType.Warning);
							}
							else
							{
								if (PackageUtils.TryReadDependencies(packageJsonPath, out var deps) && deps.Count > 0)
								{
									var projectDir = new DirectoryInfo(Application.dataPath).Parent;
									
									EditorGUILayout.LabelField("Dependencies", EditorStyles.boldLabel);
									// EditorGUI.indentLevel += 1;
									var normalColor = new Color(.7f, .7f, .7f);
									var missingColor = new Color(.8f, .7f, .2f);
									// using (new ColorScope(new Color(.7f, .7f, .7f)))
									foreach (var dep in deps)
									{
										var pathOrVersion = dep.Value;
										var isPath = false;
										if (PackageUtils.TryGetPath(proj.ProjectPath, pathOrVersion, out var fp))
										{
											isPath = true;
											if (Event.current.modifiers == EventModifiers.Alt)
												pathOrVersion = fp;
										}

										var isMissing = isPath && !Directory.Exists(fp);
										using (new ColorScope(isMissing ? missingColor : normalColor))
										{
											Object obj = default;
											if (isPath)
											{
												obj = TryFindAsset(fp);
											}
											if(obj) 
												EditorGUILayout.ObjectField(new GUIContent(dep.Key, pathOrVersion), obj, typeof(Object), false);
											else
												EditorGUILayout.LabelField(new GUIContent(dep.Key),
												new GUIContent(pathOrVersion, isMissing ? "Directory does not exist at " + fp : fp));
										}
										EditorContextUtils.CreateContextMenuForLastRect(m =>
										{
											if (isPath && Directory.Exists(fp))
												m.AddItem(new GUIContent("Open"), false, () => EditorUtility.RevealInFinder(fp));
										});
									}
									// EditorGUI.indentLevel -= 1;
								}
							}

							if (index + 1 < sceneInfo.Projects.Count)
								GUILayout.Space(5);
						}
					}
				}

				if (dirty) data.Save();
			}
			catch
			{
				// ignore
			}
			finally
			{
				EditorGUI.indentLevel -= 1;
				GUI.enabled = false;
				EditorGUILayout.EndScrollView();
			}
		}

		private static Object TryFindAsset(string fp)
		{
			// try find npmdef
			if (fp.EndsWith("~"))
			{
				fp = fp.Substring(0, fp.Length - 1) + ".npmdef";
				var file = new FileInfo(fp);
				if (file.Exists)
				{
					var nameWithoutExtension = Path.GetFileNameWithoutExtension(fp);
					var candidates = AssetDatabase.FindAssets(nameWithoutExtension);
					foreach (var can in candidates)
					{
						var path = AssetDatabase.GUIDToAssetPath(can);
						if (path.EndsWith(".npmdef"))
						{
							return AssetDatabase.LoadAssetAtPath<Object>(path);
						}
						
					}
				}
			}
			return null;
		}
	}
}