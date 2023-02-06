#if (HAS_URP && HAS_2020_LTS) || HAS_2021_LTS || HAS_UNITY_NEWER_THAN_LTS 
#define CAN_INSTALL_SAMPLES
#endif

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Threading.Tasks;
using Needle.Engine.Samples.Helpers;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEditor.SceneManagement;
using UnityEditor.UIElements;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace Needle.Engine.Samples
{
	public class SamplesWindow : EditorWindow, IHasCustomMenu
	{
		internal const string SamplesUrl = "https://engine.needle.tools/samples";
		
		// [MenuItem("Window/Needle/Needle Engine Samples", priority = -1000)]
		[MenuItem("Needle Engine/Explore Samples", priority = 150 - 1000)]
		public static void Open()
		{
			var existing = Resources.FindObjectsOfTypeAll<SamplesWindow>().FirstOrDefault();
			if (existing)
			{
				existing.Show(true);
				existing.Focus();
			}
			else
			{
				CreateWindow<SamplesWindow>().Show();
			}
		}

		private static bool DidOpen
		{
			get => SessionState.GetBool("OpenedNeedleSamplesWindow", false);
			set => SessionState.SetBool("OpenedNeedleSamplesWindow", value);
		}
		
		/// <summary>
		/// Enable to view samples "as remote"
		/// </summary>
		private static bool ForceRemoteNeedleSamples
		{
			get => SessionState.GetBool(nameof(ForceRemoteNeedleSamples), false);
			set => SessionState.SetBool(nameof(ForceRemoteNeedleSamples), value);
		}

		[InitializeOnLoadMethod]
		private static async void Init()
		{
			if (DidOpen) return;
			DidOpen = true;
			await Task.Yield();
			// Open samples window automatically on start only when in samples project 
			if(Application.dataPath.Contains("Needle Engine Samples") && Application.isBatchMode == false)
				Open();
		}

		
		public void AddItemsToMenu(GenericMenu menu)
		{
			menu.AddItem(new GUIContent("Refresh"), false, Refresh);
			menu.AddItem(new GUIContent("Reopen Window"), false, () =>
			{
				Close();
				Open();
			});
			menu.AddSeparator("");
			menu.AddItem(new GUIContent("Force Remote Samples"), ForceRemoteNeedleSamples, () =>
			{
				ForceRemoteNeedleSamples = !ForceRemoteNeedleSamples;
				HaveFetchedNeedleSamples = false;
				Close();
				Open();
			});
			if (HaveSamplesPackage)
			{
				menu.AddItem(new GUIContent("Remove Sample Package"), false, () =>
				{
					Client.Remove(Constants.SamplesPackageName);
				});
			}
		}

		private static bool HaveSamplesPackage =>
#if HAS_NEEDLE_SAMPLES
			!ForceRemoteNeedleSamples;
#else
			false;
#endif

		private void Refresh()
		{
			rootVisualElement.Clear();
			RefreshAndCreateSampleView(rootVisualElement, this);
		}

		private static bool CanInstallSamples
		{
			#if CAN_INSTALL_SAMPLES
			get => true;
			#else
			get => false;
			#endif
		}
		
		private static bool HasUnityLTSVersion
		{
			#if HAS_UNITY_NEWER_THAN_LTS
			get => false;
			#elif HAS_2020_LTS || HAS_2021_LTS
			get => true;
			#else
			get => false;
			#endif
		}

		private const string LTSWarning = "⚠️ Warning\nYou don't seem to be on a Unity LTS version.\nWe generally recommend using the latest LTS versions of Unity.";

		internal static List<SampleInfo> GetLocalSampleInfos()
		{
			var sampleInfos = AssetDatabase.FindAssets("t:" + nameof(SampleInfo))
				.Select(AssetDatabase.GUIDToAssetPath)
				.Select(AssetDatabase.LoadAssetAtPath<SampleInfo>)
				.ToList();

			AssetDatabase.Refresh();
				
			// TODO when auto collecting scenes ignore all scenes that are in subfolder depth > 1 (so not directly in a subfolder of the samples directory but further nested)
			var tempSamples = AssetDatabase.FindAssets("t:SceneAsset", new[] { Constants.SamplesDirectory });
			foreach (var sceneAsset in tempSamples
				         .Select(AssetDatabase.GUIDToAssetPath)
				         .Select(AssetDatabase.LoadAssetAtPath<SceneAsset>)
				         .OrderBy(x => x.name))
			{
				if (sampleInfos.Any(s => s.Scene == sceneAsset)) continue;
					
				var info = CreateInstance<SampleInfo>();
				info.Scene = sceneAsset;
				info.name = sceneAsset.name;
				if (TryGetScreenshot(sceneAsset.name, out var screenshotPath))
				{
					info.Thumbnail = AssetDatabase.LoadAssetAtPath<Texture2D>(screenshotPath);
				}
				sampleInfos.Add(info);
			}

			sampleInfos = sampleInfos
				.OrderBy(x => !(bool) x.Thumbnail)
				.ThenBy(x => x.DisplayNameOrName)
				.ToList();
			
			return sampleInfos;
		}
		
		internal static async void RefreshAndCreateSampleView(VisualElement parent, object context)
		{
			var loadingLabel = new Label("Loading...")
			{
				name = "LoadingLabel",
				style = {
					fontSize = 24,
					unityTextAlign = TextAnchor.UpperCenter,
					marginTop = 20,
					opacity = 0.5f,
				}
			};
			parent.Add(loadingLabel);

			List<SampleInfo> sampleInfos = default;
			
			// sampleInfos can either come from the project we're in, or come from a JSON file.
			// when the samples package is present, we use that, otherwise we fetch the JSON from elsewhere
			if (HaveSamplesPackage)
			{
				sampleInfos = GetLocalSampleInfos();
			}
			else
			{
				var serializerSettings = SerializerSettings.Get();
				serializerSettings.Context = new StreamingContext(StreamingContextStates.Persistence, context);

				var cachePath = default(string);
				
#if false // for local testing
				var rootPath = "../../";
				var jsonPath = rootPath + "samples.json";
				var json = File.ReadAllText(jsonPath);
				await Task.CompletedTask;
#else
				var jsonPath = Constants.RemoteSampleJsonPath;
				cachePath = Constants.CacheRoot + SanitizePath(Path.GetFileName(jsonPath));	
				if (!cachePath.EndsWith(".json")) cachePath += ".json";
				if (HaveFetchedNeedleSamples && File.Exists(cachePath))
					jsonPath = "file://" + Path.GetFullPath(cachePath);

				var request = new UnityWebRequest(jsonPath);
				request.downloadHandler = new DownloadHandlerBuffer();
				var op = request.SendWebRequest();
				while (!op.isDone) await Task.Yield();
				if (request.result != UnityWebRequest.Result.Success)
				{
					var errorMessage = "Error: " + request.result + ", " + request.error;
					parent.Q<Label>("LoadingLabel").text = "Failed to download samples.json.\n" + errorMessage;
					Debug.LogError(errorMessage + ", File: " + jsonPath);
					HaveFetchedNeedleSamples = false;
					return;
				}
				var json = request.downloadHandler.text;
#endif
				
				var collection = JsonConvert.DeserializeObject<SampleCollection>(json, serializerSettings);
				if (collection != null && collection.samples.Any() && !HaveFetchedNeedleSamples && cachePath != null)
				{
					try
					{
						Directory.CreateDirectory(Path.GetDirectoryName(cachePath)!);
						File.WriteAllText(cachePath, json);
						HaveFetchedNeedleSamples = true;
					}
					catch (Exception e)
					{
						Debug.LogError("Exception: " + e + " on path " + cachePath);
					}
				}

				sampleInfos = collection ? collection.samples : null;
			}

			parent.Clear();
			parent.Add(CreateSampleView(sampleInfos));
		}

		
		internal static bool HaveFetchedNeedleSamples
		{
			get => SessionState.GetBool(nameof(HaveFetchedNeedleSamples), false);
			set => SessionState.SetBool(nameof(HaveFetchedNeedleSamples), value);
		}

		private static bool TryGetScreenshot(string sceneName, out string path)
		{
			path = Constants.ScreenshotsDirectory + "/" + sceneName + ".png";
			if (File.Exists(path)) return true;
			path = Constants.ScreenshotsDirectory + "/" + sceneName + ".jpg";
			return File.Exists(path);
		}

		internal static string SanitizePath(string path)
		{
			return path.Replace("?", "_")
				.Replace(":", "")
				.Replace("/", "")
				.Replace("#", "_");
		}

		private void OnEnable()
		{
			if (!this) return;
			titleContent = new GUIContent("Needle Engine Samples", AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath("39a802f6842d896498768ef6444afe6f")));
			Refresh();
			EditorSceneManager.activeSceneChangedInEditMode += (s, o) => Refresh();
			maxSize = new Vector2(10000, 5000);
			minSize = new Vector2(360, 420);
			
			// TODO not sure how to only do this if this window hasn't been manually resized by the user
			var p = position;
			p.width = 1080;
			position = p;
		}

		private Vector2 scroll;
		private double lastClickTime;

		internal static IEnumerable<StyleSheet> StyleSheet
		{
			get
			{
				yield return AssetDatabase.LoadAssetAtPath<StyleSheet>(AssetDatabase.GUIDToAssetPath("1d7049f4814274e4b9f6f99f2bc36c90"));
				#if UNITY_2021_3_OR_NEWER
				yield return AssetDatabase.LoadAssetAtPath<StyleSheet>(AssetDatabase.GUIDToAssetPath("34d4f048a70ad6e4d940ef9c8f74c2da"));
				#endif
			}
		}
		
		private void CreateGUI()
		{

		}

		internal static VisualElement CreateSampleView(List<SampleInfo> sampleInfos)
		{
			if (sampleInfos == null) return null;
			
			var root = new VisualElement();
			var scrollView = new ScrollView();

			string viewInBrowserText = "View in a Browser " + Needle.Engine.Constants.ExternalLinkChar;
			string viewInBrowerTooltip = "View and run all samples live in your browser.";
			
			// toolbar
			var tb = new Toolbar();
			tb.Add(new ToolbarButton(() => Application.OpenURL(SamplesUrl)) { text = viewInBrowserText, tooltip = viewInBrowerTooltip });
			tb.Add(new ToolbarButton(() => Application.OpenURL("https://engine.needle.tools/docs")) { text = "Documentation " + Needle.Engine.Constants.ExternalLinkChar});
			tb.Add(new ToolbarSpacer());
			tb.Add(new SamplesSearchField(scrollView));
			root.Add(tb);
			
			var header = new VisualElement();
			header.AddToClassList("header");
			header.Add(new Label("Explore Needle Engine Samples"));
			var buttonContainer = new VisualElement();
			buttonContainer.AddToClassList("buttons");
			
			var samplesFolder = "Packages/" + Constants.SamplesPackageName + "/Runtime";
			var reallyHaveSamples = HaveSamplesPackage && Directory.Exists(samplesFolder);
			
			if (reallyHaveSamples)
			{
				
			}
			else if (!HaveSamplesPackage && CanInstallSamples)
			{
				var showWarning = !HasUnityLTSVersion;
				var text = "Install Samples Package";
				var tooltip = "Adds \"com.needle.engine-samples\" to your project.";
				if (showWarning)
				{
					text += " (LTS recommended)";
					tooltip = LTSWarning + "\n\n" + tooltip;
				}
				var installButton = new Button(InstallSamples) { text = showWarning ? "" : text, tooltip = tooltip };
				if (showWarning)
				{
					installButton.style.flexDirection = FlexDirection.Row;
					// get a texture for a warning symbol from the editor
					var warningIcon = EditorGUIUtility.IconContent("console.warnicon.sml").image as Texture2D;
					installButton.Add(new Image() { image = warningIcon });
					installButton.Add(new Label(text) { style = { marginBottom = 0 }});
				}
				buttonContainer.Add(installButton);
			}
			
			if (reallyHaveSamples)
			{
				var v = new Label("Samples Installed");
				var i = new Image() { image = EditorGUIUtility.IconContent("icons/packagemanager/dark/installed@2x.png").image };
				i.AddToClassList("icon");
				var v0 = new VisualElement() { style = { flexDirection = FlexDirection.Row } };
				v0.Add(i);
				v0.Add(v);
				buttonContainer.Add(v0);
			}
			
			if (!HaveSamplesPackage && !CanInstallSamples)
			{
				buttonContainer.Add(new Button(() =>
				{
					Application.OpenURL("https://docs.needle.tools");
				}) { text = "Learn more about installing the samples " + Needle.Engine.Constants.ExternalLinkChar, tooltip = "The samples package requires either\n · Unity 2020.3 and URP\n · Unity 2021.3+ and URP or BiRP."});
			}
			header.Add(buttonContainer);
			scrollView.Add(header);

			// samples with thumbnails
			var itemContainer = new VisualElement();
			itemContainer.AddToClassList("items");
			foreach (var sample in sampleInfos.Where(x => x.Thumbnail))
				itemContainer.Add(new Sample(sample));
			scrollView.Add(itemContainer);
			
			// samples without thumbnails
			var itemContainerNoThumbnail = new VisualElement();
			itemContainerNoThumbnail.AddToClassList("items");
			foreach (var sample in sampleInfos.Where(x => !x.Thumbnail))
				itemContainerNoThumbnail.Add(new Sample(sample));
			scrollView.Add(itemContainerNoThumbnail);
			
			root.Add(scrollView);
			foreach (var style in StyleSheet)
				if (style)
					root.styleSheets.Add(style);
			if (!EditorGUIUtility.isProSkin) root.AddToClassList("__light");

			// responsive layout - basically a media query for screen width
			const int columnWidth = 360;
			const int maxCols = 10;
			root.RegisterCallback<GeometryChangedEvent>(evt =>
			{
				for (int i = 1; i < 20; i++)
					scrollView.RemoveFromClassList("__columns_" + i);
				var cols = Mathf.FloorToInt(evt.newRect.width / columnWidth);
				cols = Mathf.Min(cols, maxCols);
				cols = Mathf.Max(cols, 1);
				scrollView.AddToClassList("__columns_" + cols);
			});

			return root;
		}

		private class SamplesSearchField : ToolbarSearchField
		{
			public SamplesSearchField(VisualElement sampleRoot)
			{
				// this.AddToClassList(ToolbarSearchField.popupVariantUssClassName);
				this.searchButton.clickable.clicked += () =>
				{
				};
				
				this.RegisterValueChangedCallback(e =>
				{
					var text = e.newValue.ToLower();
					// query samples in this container
					foreach (var sample in sampleRoot.Query<Sample>().ToList())
					{
						var shouldBeVisible =
							string.IsNullOrEmpty(text) ||
							(sample.Info.DisplayNameOrName != null && sample.Info.DisplayNameOrName.IndexOf(text, StringComparison.OrdinalIgnoreCase) > -1) || 
							(sample.Info.Description != null && sample.Info.Description.IndexOf(text, StringComparison.OrdinalIgnoreCase) > -1);
						sample.style.display = shouldBeVisible ? DisplayStyle.Flex : DisplayStyle.None;
					}
				});
			}
		}
		
        private static AddRequest currentInstallationRequest;
        
		private static async void InstallSamples()
		{
			if(currentInstallationRequest != null && !currentInstallationRequest.IsCompleted)
				return;
			
			// show Editor dialogue asking for confirmation
			var result = EditorUtility.DisplayDialog(
				"Install Samples Package", 
				"This will add the Samples package to your project.\n\n" +
				(!HasUnityLTSVersion ? LTSWarning : "") +
				"Do you want to continue?", 
				"Yes", "No");
			if (!result)
			{
				Debug.Log("Installation cancelled.");
				return;
			}
			try
			{
				EditorApplication.LockReloadAssemblies();
				Log("Installing Needle Engine Samples... please wait.");
				var progressId = Progress.Start("Installing Needle Engine Samples",
					"The samples package is being added using Unity's package manager, please stand by!",
					Progress.Options.Managed | Progress.Options.Indefinite);
				currentInstallationRequest = Client.Add(Constants.SamplesPackageName);
				while (!currentInstallationRequest.IsCompleted)
					await Task.Delay(500);
				switch (currentInstallationRequest.Status)
				{
					case StatusCode.Success:
						Progress.Finish(progressId);
						Log($"<b>{"Successfully".AsSuccess()}</b> installed Needle Engine Samples package.");
						if (HasOpenInstances<SamplesWindow>())
						{
							var window = GetWindow<SamplesWindow>();
							if (window)
							{
								// refresh window
								window.Refresh();
							}
						}
						break;
					case StatusCode.Failure:
						Progress.Finish(progressId, Progress.Status.Failed);
						Log($"<b>{"Failed".AsError()}</b> installing Needle Engine Samples package: {currentInstallationRequest.Error.message}");
						break;
					default:
						Progress.Finish(progressId);
						Log("Unexpected installation result: " + currentInstallationRequest.Status + ", " + currentInstallationRequest.Error.message);
						break;
				}
			}
			finally
			{
				currentInstallationRequest = null;
				await Task.Delay(200); // just to see the log
				EditorApplication.UnlockReloadAssemblies();
			}
		}

		private static void Log(object msg)
		{
			Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, null, "{0}", msg);
		}

		internal class Sample : VisualElement
		{
			public SampleInfo Info => sample;
			private readonly SampleInfo sample;
			
			public Sample(SampleInfo sample)
			{
				this.sample = sample;
				if (!sample.Thumbnail)
				{
					AddToClassList("no-preview");
				}
				else
				{
					var preview = new Image() { image = sample.Thumbnail, scaleMode = ScaleMode.ScaleAndCrop};
					var v = new VisualElement();
					v.AddToClassList("image-container");
					v.Add(preview);
					Add(v);
				}

				var click = new Clickable(DoubleClick);
				click.activators.Clear();
				click.activators.Add(new ManipulatorActivationFilter() { button = MouseButton.LeftMouse, clickCount = 2} );
				this.AddManipulator(click);
				this.AddManipulator(new Clickable(Click));

				var content = new VisualElement() { name = "Content" };
				var overlay = new VisualElement();
				overlay.AddToClassList("overlay");
				overlay.Add(new Label() { name = "Title", text = sample.DisplayNameOrName } );
				overlay.Add(new Label() { text = sample.Description } );
				content.Add(overlay);
				
				var options = new VisualElement();
				options.AddToClassList("options");
				if (!string.IsNullOrEmpty(sample.LiveUrl))
					options.Add(new Button(_Live) { text = "Live ↗", tooltip = "Open " + sample.LiveUrl});
				if (sample.Scene)
					options.Add(new Button(_OpenScene) { text = "Open Scene" });
				else if (!HaveSamplesPackage && CanInstallSamples)
					options.Add(new Button(InstallSamples) { text = "Install Samples" });
				content.Add(options);
				Add(content);
			}

			private void DoubleClick(EventBase evt) => _OpenScene();
			private void Click(EventBase evt) => EditorGUIUtility.PingObject(sample.Scene);

			private void _OpenScene()
			{
				if (sample.Scene) OpenScene(sample.Scene);
				else _Live();
			}

			private string NameToAnchor(string Name)
			{
				return Name.ToLowerInvariant()
					.Replace(" ", "-")
					.Replace("(", "-")
					.Replace(")", "-")
					.Replace("--","-")
					.Replace("--","-")
					.Trim('-');
			}
			
			private void _Live()
			{
				if (string.IsNullOrEmpty(sample.LiveUrl)) return;
				var url = SamplesUrl + "/?from-editor#" + NameToAnchor(sample.Name);
				Application.OpenURL(url);
				// Application.OpenURL(sample.LiveUrl);
			} 
		}

		private static void OpenScene(SceneAsset asset)
		{
			if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
			var scenePath = AssetDatabase.GetAssetPath(asset);
			if (PackageUtils.IsMutable(scenePath))
			{
				EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
			}
			else
			{
				// make a copy of the scene file in Assets/Samples/Needle Engine/scene.unity
				var samplesFolder = Path.Combine("Assets", "Samples", "Needle Engine");
				if (!Directory.Exists(samplesFolder))
					Directory.CreateDirectory(samplesFolder);
				var targetPath = Path.Combine(samplesFolder, Path.GetFileName(scenePath));
				
				if (File.Exists(targetPath))
				{
					// show dialogue or open user scene again? --- user can manually delete to reopen the original sample scene
					// if (EditorUtility.DisplayDialog("Scene already exists", "The scene file already exists in the Samples folder.\nDo you want to overwrite it?", "Overwrite and open", "Just open"))
					// 	File.Delete(targetPath);
					// else
					EditorSceneManager.OpenScene(targetPath, OpenSceneMode.Single);
				}
				else
				{
					File.Copy(scenePath, targetPath, false);
					AssetDatabase.ImportAsset(targetPath);
					EditorSceneManager.OpenScene(targetPath, OpenSceneMode.Single);
				}
			}

			GUIUtility.ExitGUI();
		}

		public static void MarkImagesDirty(VisualElement root)
		{
			root.Query<Image>().ForEach(x =>
			{
				var s = x.image;
				x.image = null;
				x.image = s;
			});
			root.MarkDirtyRepaint();
		}
	}
}