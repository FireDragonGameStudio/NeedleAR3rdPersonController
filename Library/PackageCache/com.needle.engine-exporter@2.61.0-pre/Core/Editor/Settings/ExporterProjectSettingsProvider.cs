using System;
using System.Collections.Generic;
using System.IO;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.UIElements;

namespace Needle.Engine.Settings
{
	public class ExporterProjectSettingsProvider : SettingsProvider
	{
		public const string SettingsPath = "Project/Needle/Needle Engine";

		[SettingsProvider]
		public static SettingsProvider CreateSettings()
		{
			try
			{
				ExporterProjectSettings.instance.Save();
				return new ExporterProjectSettingsProvider(SettingsPath, SettingsScope.Project);
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}

			return null;
		}

		private ExporterProjectSettingsProvider(string path, SettingsScope scopes, IEnumerable<string> keywords = null) : base(path, scopes, keywords)
		{
		}

		private Vector2 scroll;
		private const int buttonRightWidth = 50;
		private SerializedObject settingsObj;
		private SerializedProperty npmSearchPathsProperty;
		
		private static bool hasCorrectToktxVersionInstalled = true;
		private static DateTime lastToktxCheckTime;
		private static bool CheckIfToktxVersionIsInstalled()
		{
			if (DateTime.Now - lastToktxCheckTime < TimeSpan.FromSeconds(10)) return hasCorrectToktxVersionInstalled;
			return hasCorrectToktxVersionInstalled = Actions.HasMinimumToktxVersionInstalled();
		}

		public override void OnActivate(string searchContext, VisualElement rootElement)
		{
			var settings = ExporterProjectSettings.instance;
			settings.hideFlags &= ~HideFlags.NotEditable;
			settingsObj = new SerializedObject(settings);
			npmSearchPathsProperty = settingsObj?.FindProperty(nameof(ExporterProjectSettings.npmSearchPathDirectories));
			
			base.OnActivate(searchContext, rootElement);

			async void TestNpmInstalled()
			{
				npmInstalled = await ProcessHelper.RunCommand("npm", null, null, true, false);
			}

			TestNpmInstalled();

			hasCorrectToktxVersionInstalled = Actions.HasMinimumToktxVersionInstalled();
		}

		private bool npmInstalled = true;
		
		public override bool HasSearchInterest(string searchContext)
		{
			return base.HasSearchInterest(searchContext);
		}
		
		public override void OnGUI(string searchContext)
		{
			base.OnGUI(searchContext);
			var settings = ExporterProjectSettings.instance;
			if (!settings) return;
			scroll = EditorGUILayout.BeginScrollView(scroll);

			using (var change = new EditorGUI.ChangeCheckScope())
			{
				EditorGUILayout.Space();

				if (!npmInstalled)
				{
					using (new GUILayout.HorizontalScope())
					{
						EditorGUILayout.HelpBox(
							"Please make sure you have nodejs/npm installed. If you did install nodejs recently make sure you restart your computer.",
							MessageType.Warning, true);
						if (GUILayout.Button("Open nodejs website", GUILayout.Height(38)))
						{
							Application.OpenURL("https://nodejs.org/");
						}
					}
				}

				EditorGUILayout.LabelField(new GUIContent("Paths", "These paths are automatically filled in by the Needle Engine installer. Changing them manually should not be done unless you know what you're doing. If you want to reset to default just select delete the content and run the setup again."), EditorStyles.boldLabel);
				using (new EditorGUILayout.HorizontalScope())
				{
					settings.localRuntimePackage = EditorGUILayout.TextField(
						new GUIContent("Needle Engine", "Path to local needle runtime package"),
						settings.localRuntimePackage
					);
					HandleContextMenu(settings.localRuntimePackage, p => settings.localRuntimePackage = p);
					if (GUILayout.Button("Select", GUILayout.Width(buttonRightWidth)))
					{
						var selectedPath = PathUtils.SelectPath("Select path to needle js runtime package");
						if(!string.IsNullOrEmpty(selectedPath))
							settings.localRuntimePackage = PathUtils.MakeProjectRelative(selectedPath);
					}
				}

				using (new EditorGUILayout.HorizontalScope())
				{
					settings.localThreejsPackage = EditorGUILayout.TextField(
						new GUIContent("threejs", "Path to local threejs package"),
						settings.localThreejsPackage
					);
					HandleContextMenu(settings.localThreejsPackage, p => settings.localThreejsPackage = p);
					if (GUILayout.Button("Select", GUILayout.Width(buttonRightWidth)))
					{
						var selectedPath = PathUtils.SelectPath("Select path to local threejs package");
						if(!string.IsNullOrEmpty(selectedPath))
							settings.localThreejsPackage = PathUtils.MakeProjectRelative(selectedPath);
					}
				}
				
				var localPackageIsInstalled = false;
				if (!IsInstalling() && Directory.Exists(settings.localRuntimePackage) && !Directory.Exists(settings.localRuntimePackage + "/node_modules"))
				{
					EditorGUILayout.HelpBox(
						"Needle Engine runtime package seems not to be installed (no node_modules folder). Clicking this button will attempt to install it.",
						MessageType.Info, true);
					if (GUILayout.Button(new GUIContent("Install Needle Engine",
							    "Runtime javascript package seems not to be installed (no node_modules folder). Clicking this button will attempt to install it"),
						    GUILayout.Height(30)))
					{
						RunNpmInstall(settings.localRuntimePackage);
					}
				}
				else localPackageIsInstalled = true;
				EditorGUILayout.Space(1);
				ShowDirectoryExistsInfo(settings.localRuntimePackage, true);
				
				EditorGUILayout.Space(1);
				ShowDirectoryExistsInfo(settings.localThreejsPackage, true);

				if (localPackageIsInstalled && (!Directory.Exists(settings.localRuntimePackage) || !Directory.Exists(settings.localThreejsPackage)))
				{
					if (IsInstalling())
					{
						EditorGUILayout.HelpBox("Installation in progress. Wait for it to finish: see Unity progress indicator in bottom right corner)",
							MessageType.Info, true);
					}
					else
					{
						EditorGUILayout.HelpBox(
							"Not all paths above are entered correctly. This means some quick actions might not work (e.g. creating and installing a new javascript project). You can use the Button below to try find and enter the correct paths automatically.",
							MessageType.Warning, true);
						DrawFixSettingsPathsGUI();
					}
				}
				else if (!CheckIfToktxVersionIsInstalled())
				{
					GUILayout.Space(10);
					EditorGUILayout.HelpBox("Please install the recommended toktx version to support production builds. Toktx is used to compress your glb files.", MessageType.Warning);if (GUILayout.Button(new GUIContent("Download Toktx",
							"Toktx is used for compressing your glb output files when making production builds. Click this button to download the recommended toktx version and start the installer!"), GUILayout.Height(30)))
					{
						InternalActions.DownloadAndInstallToktx();
					}
				}

				EditorGUILayout.Space();
				EditorGUILayout.LabelField("Settings", EditorStyles.boldLabel);
				settings.overrideEnterPlaymode =
					EditorGUILayout.Toggle(
						new GUIContent("Override Enter Playmode",
							"When enabled clicking \"Play\" will instead start a local server and export your project to threejs if the current scene is marked for export (has an Unity → threejs exporter component)"),
						settings.overrideEnterPlaymode);
				// settings.overrideBuildSettings =
				// 	EditorGUILayout.Toggle(
				// 		new GUIContent("Override Build settings",
				// 			"When enabled clicking \"Build\" or \"Build And Run\" in the Build Settings window or using the respective shortcut will export the current scene to threejs instead of building the Unity project. "),
				// 		settings.overrideBuildSettings);
				settings.smartExport =
					EditorGUILayout.Toggle(
						new GUIContent("Smart Export",
							"When enabled the exporter will only re-export changed assets (or if a dependency of the asset changed)"),
						settings.smartExport);
				settings.allowRunningProjectFixes = EditorGUILayout.Toggle(new GUIContent("Allow Project Fixes", "When enabled Needle Exporter will attempt to automatically fix issues in your project (like when a .npmDef file was moved so the local package path changed)"), settings.allowRunningProjectFixes);
				settings.useHotReload = EditorGUILayout.Toggle(new GUIContent("Use Hot Reload", "When enabled typescript changes will applied without reloading the local server (if hot reload fails the browser will refresh normally)"), settings.useHotReload);
				settings.debugMode = EditorGUILayout.Toggle(new GUIContent("Debug Mode", ""), settings.debugMode);
				settings.generateReport =
					EditorGUILayout.Toggle(
						new GUIContent("Generate Report",
							"When enabled exported glb and glTF will write a file that contains source information about referenced assets"),
						settings.generateReport);

				GUILayout.Space(10);
				if(npmSearchPathsProperty != null)
				{
					#if UNITY_EDITOR_WIN
					using var _ = new EditorGUI.DisabledScope(true);
					#endif
					EditorGUILayout.PropertyField(npmSearchPathsProperty, 
						new GUIContent("Additional npm Search Paths", "These are only used on OSX and Linux and should be used to declare where your npm installation is or should be searched. For example in \"/usr/local/bin/\""));
					
				}
				
				
				if (change.changed)
				{
					settingsObj?.ApplyModifiedProperties();
					settings.Save();
				}

				EditorGUILayout.Space();
				using (new GUILayout.HorizontalScope())
				{
					EditorGUILayout.LabelField("Helpful Links", EditorStyles.boldLabel, GUILayout.Width(EditorGUIUtility.labelWidth));
					if (GUILayout.Button(new GUIContent("Documentation ↗", "Opens the exporter and engine documentation"))) 
						Application.OpenURL(Constants.DocumentationUrl);
					if (GUILayout.Button(new GUIContent("Samples ↗", "Open Needle Engine Samples website"))) 
						Application.OpenURL(Constants.SamplesUrl);
					if (GUILayout.Button(new GUIContent("Feedback ↗", "Opens the feedback form to help us improve the workflow (takes ~ 1 minute)")))
						Application.OpenURL(Constants.FeedbackFormUrl);
					GUILayout.FlexibleSpace();
				}
			}

			EditorGUILayout.EndScrollView();
		}

		private static void ShowDirectoryExistsInfo(string directory, bool requirePackageJson)
		{
			if (string.IsNullOrWhiteSpace(directory)) return;
			var fullLocalRuntime = Path.GetFullPath(directory);
			if (!Directory.Exists(fullLocalRuntime))
			{
				EditorGUILayout.HelpBox("Directory does not exist: " + fullLocalRuntime, MessageType.Warning, false);
			}
			else if (requirePackageJson && !File.Exists(fullLocalRuntime + "/package.json"))
			{
				EditorGUILayout.HelpBox("Directory does not contain package.json: " + fullLocalRuntime,
					MessageType.Warning, false);
			}
		}

		private static void HandleContextMenu(string path, Action<string> update)
		{
			if (Event.current.type == EventType.ContextClick)
			{
				var last = GUILayoutUtility.GetLastRect();
				if (last.Contains(Event.current.mousePosition))
				{
					var m = new GenericMenu();
					if (!string.IsNullOrEmpty(path))
					{
						if (Directory.Exists(path))
							m.AddItem(new GUIContent("Open directory"), false, () => Application.OpenURL(Path.GetFullPath(path)));
						if (new Uri(path, UriKind.RelativeOrAbsolute).IsAbsoluteUri)
							m.AddItem(new GUIContent("Make relative"), false, () => update(PathUtils.MakeProjectRelative(path)));
						else
							m.AddItem(new GUIContent("Make absolute"), false, () => update(Path.GetFullPath(path)));
					}
					else
					{
#pragma warning disable CS4014
						m.AddItem(new GUIContent("Try fix paths"), false, () => Actions.RunProjectSetup());
#pragma warning restore CS4014
					}
					m.ShowAsContext();
				}
			}
		}

		internal static async void DrawFixSettingsPathsGUI()
		{
			using (new ColorScope(Color.white))
			{
				if (GUILayout.Button("Run Needle project setup", GUILayout.Height(30)))
				{
					if (await Actions.RunProjectSetup(Actions.PathType.NeedleRuntimePackage | Actions.PathType.LocalThreejs, true))
					{
						Debug.Log(
							"Successfully found and entered paths. You should now be able to use the quick actions to setup and install and run new javascript projects.");
					}
					else
					{
						Debug.LogWarning(
							"Could not find all paths. It might fail if the Unity - Threejs exporter was installed from a registry. Please make sure you also have the Needle runtime package and Threejs fork on disc and add the paths to the fields above. Alternatively you can also enter the correct versions or local paths in the package.json of your respective project (e.g. vite project). For more information refer to the documentation.");
					}
				}
			}
		}

		

		private static async void RunNpmInstall(string dir)
		{
			await Actions.RunNpmInstallAtPath(dir, false);
			var settings = ExporterProjectSettings.instance;
			if (string.IsNullOrEmpty(settings.localThreejsPackage) || !Directory.Exists(settings.localThreejsPackage))
				await Actions.RunProjectSetup(Actions.PathType.LocalThreejs);
		}

		private static bool IsInstalling()
		{
			return Actions.IsInstalling();
		}
	}
}