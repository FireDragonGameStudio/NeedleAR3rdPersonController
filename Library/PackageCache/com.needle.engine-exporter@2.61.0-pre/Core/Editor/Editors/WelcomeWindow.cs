using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Samples;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.SceneTemplate;
using UnityEngine;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace Needle.Engine.Editors
{
	public interface IWelcomeWindow
	{
		public bool ShowAtStartup { get; set; }
		public int TutorialStep { get; set; }
		void Close();
	}

	public class WelcomeWindow : EditorWindow, ICanRebuild, IWelcomeWindow
	{
		[MenuItem(Constants.MenuItemRoot + "/Welcome Window", false, Constants.MenuItemOrder - 1001)]
		private static void MenuItemOpen()
		{
			Open(true);
		}

		public static bool ShowAtStartup
		{
			get => EditorPrefs.GetBool("NeedleEngineWelcome_ShowAtStartup", true);
			set => EditorPrefs.SetBool("NeedleEngineWelcome_ShowAtStartup", value);
		}

		bool IWelcomeWindow.ShowAtStartup
		{
			get => ShowAtStartup;
			set => ShowAtStartup = value;
		}

		private static bool EditorStartup
		{
			get => SessionState.GetBool("NeedleEngineWelcome_Startup", true);
			set => SessionState.SetBool("NeedleEngineWelcome_Startup", value);
		}

		[InitializeOnLoadMethod]
		private static async void Init()
		{
			var s = ExporterUserSettings.instance;
			while (EditorApplication.isUpdating || EditorApplication.isCompiling) await Task.Delay(1000);
			await Task.Delay(1000);

			if (s.FirstInstallation)
			{
				s.FirstInstallation = false;
				s.Save();
				Open(false);
			}
			else if (EditorStartup)
			{
				EditorStartup = false;
				if (ShowAtStartup)
				{
					Open(false);
				}
				else
				{
					FindObjectOfType<WelcomeWindow>()?.Close();
				}
			}
		}

		public void AddItemsToMenu(GenericMenu menu)
		{
			menu.AddItem(new GUIContent("Refresh"), false, OnEnable);
		}

		public static WelcomeWindow Open(bool userAction)
		{
			WelcomeWindow window = null;
			if (HasOpenInstances<WelcomeWindow>())
			{
				FocusWindowIfItsOpen<WelcomeWindow>();
				window = Resources.FindObjectsOfTypeAll<WelcomeWindow>().FirstOrDefault(w => w);
				if (window)
				{
					window.Show();
					return window;
				}
			}
			window = CreateInstance<WelcomeWindow>();
			window.Show();
			return window;
		}

		// private bool isFirstInstallation = false;

		private void OnEnable()
		{
			if (!this) return;
			titleContent = new GUIContent("Welcome");
			UxmlWatcher.Register(AssetDatabase.GUIDToAssetPath("3a2a854189a948f9b4646e41524e47ae"), this);
			UxmlWatcher.Register(AssetDatabase.GUIDToAssetPath("e66b654596c34b8aa460cd295a9df397"), this);
			UxmlWatcher.Register(AssetDatabase.GUIDToAssetPath("f85c6c94ddbd41b693a42604925dab44"), this);
			BuildWelcomeWindowUI(rootVisualElement, this);
			minSize = new Vector2(300, 300);
			maxSize = new Vector2(600, 400);
			var pos = position;
			pos.width = 400;
			position = pos;
		}


		public int TutorialStep
		{
			get => EditorPrefs.GetInt("NeedleTinyTutorial_step", 0);
			set => EditorPrefs.SetInt("NeedleTinyTutorial_step", value);
		}

		public void Rebuild()
		{
			BuildWelcomeWindowUI(rootVisualElement, this);
		}
		
		private static void BuildWelcomeWindowUI(VisualElement rootVisualElement, IWelcomeWindow window = null)
		{
			var uiAsset = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(AssetDatabase.GUIDToAssetPath("e66b654596c34b8aa460cd295a9df397"));
			var ui = uiAsset.CloneTree();
			if (ui != null)
			{
				ui.AddToClassList("main");
				if (!EditorGUIUtility.isProSkin) ui.AddToClassList("__light");

				rootVisualElement.Clear();
				rootVisualElement.Add(ui);

				if (window != null)
				{
					var showAtStartupToggle = ui.Query<Toggle>(null, "show-at-startup").First();
					if (showAtStartupToggle != null)
					{
						showAtStartupToggle.value = window.ShowAtStartup;
						showAtStartupToggle.RegisterValueChangedCallback(cb => { window.ShowAtStartup = cb.newValue; });
					}
				}

				ui.Query<Button>(null, "dismiss").ForEach(b =>
				{
					var p = b.parent;
					b.clicked += Hide;

					void Hide()
					{
						p.visible = false;
						p.style.display = DisplayStyle.None;
					}
				});

				ui.Query<Button>(null, "link").ForEach(b => { b.clicked += () => Application.OpenURL(b.name); });


				ui.RegisterAction("open-nodejs-website", () => Application.OpenURL("https://nodejs.org/"));
				ui.RegisterAction("create-scene",
					() => 
						// EditorApplication.ExecuteMenuItem("File/New Scene"));
						SceneTemplateService.Instantiate(AssetDatabase.LoadAssetAtPath<SceneTemplateAsset>(AssetDatabase.GUIDToAssetPath("9b88182624adbd145beb1226ac5f9a95")), false, null));
				ui.RegisterAction("select-exporter", () =>
				{
					var exp = Object.FindObjectOfType<ExportInfo>();
					EditorGUIUtility.PingObject(exp);
					Selection.activeObject = exp;
				});
#pragma warning disable CS4014
				ui.RegisterAction("install-package", () => Actions.InstallPackage(false));
#pragma warning restore CS4014
				ui.RegisterAction("hide-tutorial", () => ui.Query<VisualElement>(null, "tutorial").ForEach(e => e.AddToClassList("hidden")));
				ui.RegisterAction("close-window", () => window?.Close());
				ui.RegisterAction("view-samples", () => GetWindow<SamplesWindow>().Show());

				HookupSteps(ui, window);
			}
		}

		private static async void HookupSteps(VisualElement ui, IWelcomeWindow window)
		{
			var maxStep = 0;
			var stepElements = new List<VisualElement>();
			var prevButtons = new List<Button>();
			var nextButtons = new List<Button>();
			var hasNodeJsInstalled = false;

			ui.Query<Button>(null, "prev-step").ForEach(b =>
			{
				prevButtons.Add(b);
				b.clicked += () => UpdateSteps(-1);
			});
			ui.Query<Button>(null, "next-step").ForEach(b =>
			{
				nextButtons.Add(b);
				b.clicked += () => UpdateSteps(1);
			});

			ui.Query<VisualElement>(null, "steps").ForEach(b => { stepElements.Add(b); });


			void UpdateSteps(int offset = 0)
			{
				var nextStep = window.TutorialStep + offset;
				if (nextStep >= 0 && nextStep < maxStep)
					window.TutorialStep = nextStep;
				maxStep = 0;

				foreach (var b in stepElements)
				{
					maxStep = Mathf.Max(0, b.childCount);
					for (var i = 0; i < b.childCount; i++)
					{
						var ch = b[i];
						if (i != window.TutorialStep) ch.AddToClassList("hidden");
						else
						{
							ch.RemoveFromClassList("hidden");
							if (ch.ClassListContains("action:skip_IfHasNodeJs"))
							{
								// skip this step if nodejs is installed
								if(offset != 0 && hasNodeJsInstalled) 
									UpdateSteps(offset > 0 ? 1 : -1);
							}

							var hideButtons = ch.ClassListContains("require-nodejs") && !hasNodeJsInstalled;
							ui.Query<VisualElement>(null, "tutorial-steps").ForEach(el =>
							{
								if (hideButtons) el.AddToClassList("hidden");
								else el.RemoveFromClassList("hidden");
							});
						}
					}
				}
				foreach (var el in prevButtons) el.SetEnabled(window.TutorialStep > 0);
				foreach (var el in nextButtons) el.SetEnabled(window.TutorialStep + 1 < maxStep);
			}

			ui.focusable = true;
			ui.RegisterCallback<KeyUpEvent>(evt =>
			{
				if (evt.keyCode == KeyCode.RightArrow) UpdateSteps(1);
				if (evt.keyCode == KeyCode.LeftArrow) UpdateSteps(-1);
			});
			UpdateSteps();


			await TestIfHasNodeJsInstalledAndSkipIfNot();
			UpdateSteps();
			
			async Task TestIfHasNodeJsInstalledAndSkipIfNot()
			{
				if (!hasNodeJsInstalled) hasNodeJsInstalled = await Actions.HasNpmInstalled();
			}
		}

		private static GUIStyle _toolbarButtonStyle;
		private void ShowButton(Rect toolbarPosition)
		{
			_toolbarButtonStyle ??= new GUIStyle("IconButton");
			if (GUI.Button(toolbarPosition, EditorGUIUtility.IconContent("_Help"), _toolbarButtonStyle))
				Application.OpenURL("https://fwd.needle.tools/needle-engine/docs");
		}
	}
}