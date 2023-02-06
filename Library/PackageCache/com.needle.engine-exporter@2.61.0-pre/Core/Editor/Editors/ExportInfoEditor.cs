using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Problems;
using Needle.Engine.Projects;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace Needle.Engine.Editors
{
	[CustomEditor(typeof(ExportInfo))]
	public class ExportInfoEditor : Editor
	{
		private static GUIStyle _multiLineLabel;

		private static GUIStyle multilineLabel
		{
			get
			{
				_multiLineLabel ??= new GUIStyle(EditorStyles.label);
				_multiLineLabel.wordWrap = true;
				return _multiLineLabel;
			}
		}

		private readonly List<IExportableObject> exportableObjectsInScene = new List<IExportableObject>();
		private readonly IDictionary<string, IList<IProblem>> problems = new Dictionary<string, IList<IProblem>>();

		public static event Action<ExportInfo> Enabled, LateInspectorGUI;
		
		private SerializedProperty directoryNameProperty, autoExportProperty;

		private void OnEnable()
		{
			ProjectGenerator.RefreshTemplates();
			templateOptions = ProjectGenerator.Templates.Select(t => t.DisplayName).ToArray();

			var projectOptionsList = new List<string>();
			var projectOptionsDisplayList = new List<string>();
			foreach (var proj in ProjectsData.EnumerateProjects())
			{
				if (!proj.Exists) continue;
				projectOptionsList.Add(proj.ProjectPath);
				projectOptionsDisplayList.Add(Regex.Replace(proj.ProjectPath, "[\\/\\.]", " ").Trim());
			}
			projectOptions = projectOptionsList.ToArray();
			projectDisplayOptions = projectOptionsDisplayList.ToArray();
			directoryNameProperty = serializedObject.FindProperty(nameof(ExportInfo.DirectoryName));
			autoExportProperty = serializedObject.FindProperty(nameof(ExportInfo.AutoExport));

			TestServerIsRunning();
			exportableObjectsInScene.Clear();
			ObjectUtils.FindObjectsOfType(exportableObjectsInScene);
			ValidateProject();
			Enabled?.Invoke(target as ExportInfo);
			Actions.RunProjectSetupIfNecessary();
			
		}

		private void OnDisable()
		{
			serverIsRunningRoutine = false;
		}

		private bool serverIsRunning = true;
		private bool serverIsRunningRoutine = false;

		private async void TestServerIsRunning()
		{
			if (serverIsRunningRoutine) return;
			serverIsRunningRoutine = true;
			while (serverIsRunningRoutine)
			{
				var res = await WebHelper.IsRespondingWithStatus(WebHelper.GetLocalServerUrl());
				serverIsRunning = res.success;
				// if we get a certificate error unity logs messages to the console
				// this happens when another server is running on this address
				if (res.isCertificateError) break;
				await Task.Delay(2000);
			}
		}

		private static int selectedIndex
		{
			get => SessionState.GetInt("NeedleThreeProjectTemplateIndex", 0);
			set => SessionState.SetInt("NeedleThreeProjectTemplateIndex", value);
		}

		public override VisualElement CreateInspectorGUI()
		{
			var t = target as ExportInfo;
			if (!t) return null;
			var root = new VisualElement();
			var header = new VisualElement();
			UIComponents.BuildHeader(header);
			root.Add(header);
			var mainContainer = new IMGUIContainer();
			mainContainer.onGUIHandler += OnInspectorGUI;
			root.Add(mainContainer);
			return root;
		}
		
		private static string[] templateOptions;
		private static string[] projectOptions, projectDisplayOptions;

		private static readonly string[] invalidDirectories =
		{
			"Assets", "Library", "Temp", "Packages", "Logs", ".idea", "obj", "ProjectSettings", "UserSettings"
		};

		public override void OnInspectorGUI()
		{
			var t = target as ExportInfo;
			if (!t) return;
			GUI.color = Color.white;

			using (var change = new EditorGUI.ChangeCheckScope())
			{
				var needExit = false;
				using (new EditorGUILayout.HorizontalScope())
				{
					EditorGUILayout.PropertyField(this.directoryNameProperty, new GUIContent("Project Folder", "The web development folder. This is where your actual web project is located (and will be generated if it doesnt exist yet). The path is relative to your Unity project folder."));
					if (GUILayout.Button(("Pick"), GUILayout.Width(35)))
					{
						needExit = true;
						var folder = Path.GetFullPath(t.GetProjectDirectory());
						if (!Directory.Exists(folder))
						{
							folder = Path.GetFullPath(Application.dataPath + "/../");
							var previouslySelectedPath = EditorPrefs.GetString("Needle_PreviouslySelectedProjectDirectory");
							if (!string.IsNullOrEmpty(previouslySelectedPath) && Directory.Exists(previouslySelectedPath) &&
							    previouslySelectedPath.StartsWith(folder))
								folder = previouslySelectedPath;
						}
						var selectedPath = EditorUtility.OpenFolderPanel("Select Needle Project folder", folder, string.Empty);
						if (!string.IsNullOrEmpty(selectedPath) && Directory.Exists(selectedPath))
						{
							EditorPrefs.SetString("Needle_PreviouslySelectedProjectDirectory", Path.GetFullPath(selectedPath));
							if (!File.Exists(selectedPath + "/package.json"))
								selectedPath += "/" + SceneManager.GetActiveScene().name;
							Debug.Log("Selected path: " + selectedPath);
							directoryNameProperty.stringValue = PathUtils.MakeProjectRelative(selectedPath);
						}
					}
				}
				
				EditorGUILayout.PropertyField(this.autoExportProperty);
				
				if (change.changed)
				{
					this.serializedObject.ApplyModifiedProperties();
					TypesUtils.MarkDirty();
					if(needExit)
						GUIUtility.ExitGUI();
				}
			}
			// ComponentEditorUtils.DrawDefaultInspectorWithoutScriptField(this.serializedObject);

			var hasPath = !string.IsNullOrWhiteSpace(t.DirectoryName);
			var projectExists = hasPath
			                    && Directory.Exists(t.DirectoryName)
			                    && File.Exists(t.DirectoryName + "/package.json");
			var fullDirectoryPath = t.GetProjectDirectory();
			var settings = ExporterProjectSettings.instance;
			var isInstalled = settings.IsInstalled();

			if (!hasPath && isInstalled)
			{
				EditorGUILayout.HelpBox("Enter a directory name/path where the threejs project should be generated.", MessageType.Warning);
				GUILayout.Space(5);
			}
			// else
			// {
			// var path = string.IsNullOrWhiteSpace(t.DirectoryName) ? t.DirectoryName : Path.GetFullPath(t.DirectoryName);
			// if (projectExists)
			// 	EditorGUILayout.HelpBox("Project Directory:\n" + path, MessageType.None);
			// }


			var isValidDirectory = t.IsValidDirectory();
			if (hasPath && !isValidDirectory)
			{
				if (Path.IsPathRooted(t.DirectoryName))
				{
					EditorGUILayout.HelpBox("Absolute paths are not allowed!", MessageType.Error);
				}
				else 
					EditorGUILayout.HelpBox("The Project folder is not valid!", MessageType.Error);
			}

			if (hasPath && !projectExists && isValidDirectory)
			{
				EditorGUILayout.HelpBox(Path.GetFullPath(fullDirectoryPath), MessageType.None);
			}


			if (hasPath && !Directory.Exists(t.DirectoryName))
			{
				if (t.IsTempProject())
				{
					EditorGUILayout.HelpBox(
						"This is a temporary project path because it is in a directory that is generally excluded from VC. It will be generated from the default template.",
						MessageType.None);
				}
			}
			
			// EditorGUILayout.Space();

			if (hasPath && Directory.Exists(t.DirectoryName))
			{
				if (t.IsTempProject())
				{
					EditorGUILayout.HelpBox("This is a temporary project", MessageType.None);
				}

				GUILayout.Space(5);

				using (new EditorGUILayout.HorizontalScope())
				{
					if (GUILayout.Button("Directory ↗"))
					{
						var packagePath = t.DirectoryName + "/package.json";
						if (File.Exists(packagePath)) EditorUtility.RevealInFinder(packagePath);
						else EditorUtility.RevealInFinder(Path.GetFullPath(t.DirectoryName));
					}

					if (GUILayout.Button("VS Workspace ↗"))
					{
						WorkspaceUtils.OpenWorkspace(t.GetProjectDirectory());
					}
					if (GUILayout.Button("Settings"))
						Actions.OpenNeedleExporterProjectSettings();
				}
				EditorGUILayout.Space();
			}
			
			if (isValidDirectory && Actions.IsInstalling())
			{
				EditorGUILayout.HelpBox(
					"Installation in progress. Please wait for it to finish. See progress indicator in bottom right corner in Unity.",
					MessageType.Info, true);
				ShowVersionInfo();
				return;
			}
			if (isValidDirectory && !isInstalled && !Actions.ProjectSetupIsRunning)
			{
				EditorGUILayout.HelpBox(
					"Project requires installation. Please click the button below to install the needle runtime npm package.",
					MessageType.Warning, true);
				ExporterProjectSettingsProvider.DrawFixSettingsPathsGUI();
				ShowVersionInfo();
				return;
			}

			var moduleDirectory = ProjectInfo.GetNeedleEngineRuntimePackageDirectory(t.GetProjectDirectory());
			isInstalled = Directory.Exists(moduleDirectory);
			if (isValidDirectory && !isInstalled && projectExists)
			{
				var alt = Event.current.modifiers == EventModifiers.Alt;
				var logMessage = "Project requires installation. Please run install (button below).";
				EditorGUILayout.HelpBox(!alt
						? logMessage
						: logMessage +
						  $"\n\n" +
						  $"Runtime ({Path.GetFullPath(settings.localRuntimePackage)}): {File.Exists(settings.localRuntimePackage + "/package.json")}\n" +
						  $"Three.js ({Path.GetFullPath(settings.localThreejsPackage)}): {File.Exists(settings.localThreejsPackage + "/package.json")}\n" +
						  $"Project Directory ({t.GetProjectDirectory()}): {Directory.Exists(t.GetProjectDirectory())}\n" +
						  $"Project Modules ({moduleDirectory}): {Directory.Exists(moduleDirectory)}",
					MessageType.Warning, true);
			}

			if (!string.IsNullOrWhiteSpace(t.DirectoryName))
			{
				// using (new EditorGUI.DisabledScope(!isInstalled))
				if (!projectExists)
				{
					// DrawSelectExistingProjectGUI(t, serializedObject);
					DrawProjectTemplateGUI(t);
				}
				else if(isValidDirectory)
				{
					EditorGUILayout.LabelField("Quick Actions", EditorStyles.boldLabel);
					using (new GUILayout.HorizontalScope())
					{
						using (new EditorGUI.DisabledScope(Actions.IsInstalling()))
						{
							// using (new ColorScope(isInstalled ? Color.white : new Color(.8f, 1f, .5f)))
							{
								var alt = Event.current.modifiers == EventModifiers.Alt;
								if (alt)
								{
									if (GUILayout.Button(new GUIContent("Clean Install",
										    "Removes the node_modules folder and then re-installs all npm packages in your project directory.")))
									{
										RunInstall(true);
										GUIUtility.ExitGUI();
									}
								}
								else
								{
									if (GUILayout.Button(new GUIContent("Install",
										    "Installs npm packages in your project directory (Hold ALT to perform a clean installation)")))
									{
										RunInstall(false);
										GUIUtility.ExitGUI();
									}
								}
							}
						}

						DrawStartServerButtons(fullDirectoryPath, serverIsRunning);
					}
					using (new GUILayout.HorizontalScope())
					{
						var fullExport = Event.current.modifiers == EventModifiers.Alt;
						var text = !serverIsRunning ? "Play ▶" : "Play ↺";
						if (fullExport) text = "Full Export & Play ▶";
						
						if (GUILayout.Button(
							    new GUIContent(text,
								    "Build for local development. Requires local server to run.\n\nTip: When Override Playmode is enabled in settings you can also just click the Play button to run your project.\n\nHold ALT to perform a full export (it will clean caches before running)"),
							    GUILayout.Height(30)))
						{
							if (fullExport)
							{
								Actions.ClearCaches(t);
							}
							Actions.Play();
							GUIUtility.ExitGUI();
							return;
						}
					}
					// EditorGUILayout.Space();
					// EditorGUILayout.LabelField("Build Distribution", EditorStyles.boldLabel);
					// using (new GUILayout.HorizontalScope())
					// {
					// 	if (GUILayout.Button(new GUIContent("Build Development", "Runs build dist command")))
					// 	{
					// 		MenuItems.BuildForDist_Dev(false);
					// 		GUIUtility.ExitGUI();
					// 		return;
					// 	}
					// 	if (GUILayout.Button(new GUIContent("Build Production", "Runs build dist command with compression")))
					// 	{
					// 		MenuItems.BuildForDist_Production(false);
					// 		GUIUtility.ExitGUI();
					// 		return;
					// 	}
					// }
				}

				LateInspectorGUI?.Invoke(t);

				ShowVersionInfo();
				ShowUpdateInfo();

				if (isInstalled && exportableObjectsInScene.Count <= 0)
				{
					EditorGUILayout.HelpBox("Scene does not contain any glTF objects", MessageType.Warning);
					if (GUILayout.Button("Create glTF Object"))
					{
						SceneActions.CreateGltfObject();
					}
				}

				ValidateProject();
				if (problems.Count > 0)
				{
					var hasFixesForProblems = false;
					foreach (var kvp in problems)
					{
						if (kvp.Value?.Count > 0)
						{
							var text = kvp.Value.Print();
							EditorGUILayout.HelpBox(kvp.Key + ": " + text, MessageType.Warning);
							if (!hasFixesForProblems)
								hasFixesForProblems = kvp.Value.Any(p => p.Fix != null);
						}
					}

					if (hasFixesForProblems && GUILayout.Button("Fix problems"))
					{
						ProblemSolver.TryFixProblemsButIDontCareIfItWorks(t.GetProjectDirectory(), problems.Values.SelectMany(x => x).ToList());
						lastProblemSearchTime = DateTime.MinValue;
					}
				}
			}
		}

		internal static void DrawStartServerButtons(string fullDirectoryPath, bool serverIsRunning = false)
		{
			var canStartServer = Directory.Exists(fullDirectoryPath + "/assets") && Directory.Exists(fullDirectoryPath + "/node_modules");
			using (new EditorGUI.DisabledScope(!canStartServer))
			{
				var startUsingIp = Event.current.modifiers != EventModifiers.Alt;
				if (serverIsRunning)
				{
					var label = startUsingIp ? "Open Server ↗" : "Open Server (localhost) ↗";
					if (GUILayout.Button(new GUIContent(label, "Open server in a browser.\nHold ALT to open using localhost instead of IP address")))
					{
						Application.OpenURL(WebHelper.GetLocalServerUrl(startUsingIp));
					}
				}
				else
				{
					var tooltip = canStartServer ? "Starts the local development server. This is done automatically when you click Play.\nHold ALT to open using localhost instead of IP address"
						: "Cannot start server - you need to run Install first or click Play";
					var label = startUsingIp ? "Start Server ↗" : "Start Server (localhost) ↗";
					if (GUILayout.Button(new GUIContent(label, tooltip)))
					{
						MenuItems.StartDevelopmentServer(new DefaultProjectInfo(fullDirectoryPath), startUsingIp);
					}
				}
			}
		}

		private DateTime lastProblemSearchTime = DateTime.MinValue;

		private void ValidateProject()
		{
			var now = DateTime.Now;
			if ((now - lastProblemSearchTime).TotalSeconds < 5f) return;
			lastProblemSearchTime = now;
			problems.Clear();
			var exp = target as ExportInfo;
			if (!exp || !exp.Exists()) return;
			var packageJson = exp.PackageJsonPath;
			if (ProjectValidator.FindProblems(packageJson, out var res))
			{
				foreach (var prob in res)
				{
					if (!problems.ContainsKey(prob.Id)) problems.Add(prob.Id, new List<IProblem>());
					problems[prob.Id].Add(prob);
				}
			}
		}

		private async void RunInstall(bool clean)
		{
			await Actions.InstallPackage(clean);
		}

		private static async void GenerateProject(string path)
		{
			if (selectedIndex < ProjectGenerator.Templates.Count)
			{
				var template = ProjectGenerator.Templates[selectedIndex];
				await ProjectGenerator.CreateFromTemplate(path, template);
			}
			else Debug.LogWarning("Please select a project template from the dropdown");
		}

		public static bool TryGetVsCodeWorkspacePath(string directory, out string path)
		{
			return WorkspaceUtils.TryGetWorkspace(directory, out path);
		}

		private static void DrawSelectExistingProjectGUI(ExportInfo t, SerializedObject obj)
		{
			if (projectOptions.Length <= 0) return;
			EditorGUILayout.LabelField("Select an existing project", EditorStyles.boldLabel);
			using (var scope = new EditorGUI.ChangeCheckScope())
			{
				var selection = EditorGUILayout.Popup("Projects", 0, projectDisplayOptions);
				if (scope.changed && selection >= 0 && selection <= projectOptions.Length)
				{
					var selected = projectOptions[selection];
					var prop = obj.FindProperty(nameof(t.DirectoryName));
					if (prop == null)
					{
						t.DirectoryName = selected;
					}
					else
					{
						prop.stringValue = selected;
						obj.ApplyModifiedProperties();
					}
				}
			}
			GUILayout.Space(10);
		}

		private static void DrawProjectTemplateGUI(ExportInfo t)
		{
			using (new EditorGUI.DisabledScope(!t.IsValidDirectory()))
			{
				GUILayout.Space(6);
				var hasPath = !string.IsNullOrWhiteSpace(t.DirectoryName);
				EditorGUILayout.LabelField("Generate a new web project", EditorStyles.boldLabel);
				var dir = hasPath ? Path.GetFullPath(t.DirectoryName) : "";
				if (Directory.Exists(dir) && Directory.GetFileSystemEntries(dir).Length > 0)
				{
					EditorGUILayout.HelpBox(
						"Directory is not empty but also does not contain a package.json! Please select a new or empty directory path to generate a new project or a directory containing a package.json.",
						MessageType.Error);
				}
				else if (Directory.Exists(dir) && invalidDirectories.Contains(new DirectoryInfo(dir).Name))
				{
					EditorGUILayout.HelpBox("Directory is not allowed: " + new DirectoryInfo(dir).Name, MessageType.Error);
				}
				else
				{
					selectedIndex = EditorGUILayout.Popup("Template", selectedIndex, templateOptions);
					var validSelection = selectedIndex >= 0 && selectedIndex < ProjectGenerator.Templates.Count;
					if (!validSelection) EditorGUILayout.HelpBox("Selected template does not exist", MessageType.Warning);
					var grey = new Color(.7f, .7f, .7f);
					using (new EditorGUI.DisabledScope(!validSelection))
					{
						if (validSelection)
						{
							var template = ProjectGenerator.Templates[selectedIndex];
							using (new ColorScope(grey))
							{
								if (template != null && !string.IsNullOrWhiteSpace(template.Description))
								{
									EditorGUILayout.LabelField(template.Description, multilineLabel);
									if (template.Links.Any())
									{
										EditorGUILayout.BeginHorizontal();
										EditorGUILayout.PrefixLabel("Learn More");
										EditorGUILayout.BeginVertical();
										foreach (var link in template.Links)
										{
											if (string.IsNullOrWhiteSpace(link)) continue;
											var l = link;
											if (!l.StartsWith("http")) l = "https://" + l;
											if (GUILayout.Button(link + " ↗", EditorStyles.linkLabel))
												Application.OpenURL(l);
										}
										EditorGUILayout.EndVertical();
										EditorGUILayout.EndHorizontal();
									}
								}
							}
						}
						GUILayout.Space(6);
						var fullDirectoryPath = t.GetProjectDirectory();
						var appendix = ""; // validSelection ? (" using Template " + ProjectGenerator.Templates[selectedIndex].name + "") : "";
						var path = Path.GetFullPath(fullDirectoryPath);
						if (GUILayout.Button(new GUIContent("Generate Project" + appendix, "Clicking this button will generate a new project in " + path),
							    GUILayout.Height(30)))
						{
							var template = ProjectGenerator.Templates[selectedIndex];
							if (!template.HasPackageJson())
							{
								if (!EditorUtility.DisplayDialog("Template check",
									    $"Template is missing package.json - are you sure you want to use {Path.GetFullPath(template.GetPath())} as a web template?", "Yes copy content", "Cancel"))
								{
									Debug.Log("Cancelled generating project from " + template.GetFullPath());
									return;
								}
							}
							GenerateProject(t.DirectoryName);
							EditorGUILayout.Space(5);
						}
						GUILayout.Space(10);
					}
				}
			}
		}

		private static void ShowVersionInfo()
		{
			using (new ColorScope(new Color(.65f, .65f, .65f)))
			{
				GUILayout.Space(3);
				var exporterVersion = ProjectInfo.GetCurrentNeedleExporterPackageVersion(out var exporterPackageJsonPath);
				var runtimeVersion = ProjectInfo.GetCurrentNeedleEnginePackageVersion(out var runtimePackageJsonPath);
				if (exporterVersion != null || runtimeVersion != null)
				{
					var exporterFullPath = Path.GetFullPath(exporterPackageJsonPath);
					var engineFullPath = Path.GetFullPath(runtimePackageJsonPath);
					var exporterLocalPostfix = exporterFullPath.Contains("PackageCache") ? "" : " (local)";
					var runtimeLocalPostfix = engineFullPath.Contains("PackageCache") ? "" : " (local)";
					const string tooltipExporter = "These are the currently installed Needle exporter and js runtime versions. Context click for quick access";
					EditorGUILayout.LabelField(new GUIContent(
						$"Exporter {exporterVersion}{exporterLocalPostfix}\tRuntime {runtimeVersion}{runtimeLocalPostfix}", tooltipExporter));
					PathUtils.AddContextMenu(m =>
					{
						var hasExporter = File.Exists(exporterPackageJsonPath);
						var hasRuntime = File.Exists(runtimePackageJsonPath);
						if (hasExporter)
						{
							m.AddItem(new GUIContent("Exporter/Show package.json"), false, () => EditorUtility.RevealInFinder(exporterFullPath));
							m.AddItem(new GUIContent("Exporter/Open package.json"), false, () => EditorUtility.OpenWithDefaultApp(exporterFullPath));
						}
						if (hasRuntime)
						{
							m.AddItem(new GUIContent("Runtime/Show package.json"), false, () => EditorUtility.RevealInFinder(engineFullPath));
							m.AddItem(new GUIContent("Runtime/Open package.json"), false, () => EditorUtility.OpenWithDefaultApp(engineFullPath));
						}
						if (hasExporter && hasRuntime)
						{
							m.AddItem(new GUIContent("Open package.json and changelogs"), false, () =>
							{
								var fp1 = Path.GetFullPath(runtimePackageJsonPath);
								var fp2 = Path.GetFullPath(exporterPackageJsonPath);
								var fp3 = Path.GetFullPath(Path.GetDirectoryName(runtimePackageJsonPath) + "/Changelog.md");
								var fp4 = Path.GetFullPath(Path.GetDirectoryName(exporterPackageJsonPath) + "/Changelog.md");
								EditorUtility.OpenWithDefaultApp(fp1);
								EditorUtility.OpenWithDefaultApp(fp2);
								EditorUtility.OpenWithDefaultApp(fp3);
								EditorUtility.OpenWithDefaultApp(fp4);
							});
							m.AddItem(new GUIContent("Open directories"), false, () =>
							{
								var fp1 = Path.GetFullPath(runtimePackageJsonPath);
								var fp2 = Path.GetFullPath(exporterPackageJsonPath);
								EditorUtility.RevealInFinder(fp1);
								EditorUtility.RevealInFinder(fp2);
							});
						}
					});
				}
			}
		}

		private static AddRequest _addRequest;

		private static void ShowUpdateInfo()
		{
			VersionsUtil.HasExporterPackageUpdate(out var latestExporterPackage);
			VersionsUtil.HasRuntimePackageUpdate(out var latestRuntimePackage);
			var packageInfo = latestExporterPackage ?? latestRuntimePackage;
			if (packageInfo != null)
			{
				var name = packageInfo?.name ?? Constants.UnityPackageName;
				var displayName = packageInfo?.displayName ?? "Needle Engine";
				var version = packageInfo?.version ?? "0.0.0";
				var message = "Update available for package " + displayName + " to version " + version;

				GUILayout.Space(5);
				using (new EditorGUILayout.HorizontalScope())
				{
					var installUpdateImmediately = Event.current.modifiers == EventModifiers.Alt;
					EditorGUILayout.HelpBox(new GUIContent(message, version), true);
					if (GUILayout.Button(new GUIContent(installUpdateImmediately ? "Install" : "Open",
						    "Clicking this button will open the PackageManager. Hold ALT while clicking to install without opening Package Manager.")))
					{
						if (_addRequest != null && !_addRequest.IsCompleted)
						{
							Debug.LogWarning("Add request is still running: " + _addRequest.Status);
							return;
						}

						VersionsUtil.ClearCache();

						if (!installUpdateImmediately)
						{
							Debug.Log("Open " + name + " in PackageManager");
							UnityEditor.PackageManager.UI.Window.Open(name);
						}
						else
						{
							if (EditorUtility.DisplayDialog("Update " + displayName,
								    "Do you want to update " + name + " to version " + version + "?", "Yes, update package",
								    "No, do not update"))
							{
								Debug.Log("Will update package " + name + " to version " + version);
								_addRequest = Client.Add(name + "@" + version);
								WaitForRequestCompleted();

								async void WaitForRequestCompleted()
								{
									while (!_addRequest.IsCompleted) await Task.Delay(100);
									if (_addRequest.Status == StatusCode.Failure) Debug.LogError(_addRequest.Error?.message);
									else Debug.Log("Updating " + name + " to " + version + " completed");
									VersionsUtil.ClearCache();
								}

								GUIUtility.ExitGUI();
							}
						}
					}
				}
			}
		}
	}
}