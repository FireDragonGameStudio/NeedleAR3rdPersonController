using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Deployment
{
	[CustomEditor(typeof(DeployToGlitch))]
	public class DeployToGlitchEditor : UnityEditor.Editor
	{
		private ExportInfo exp;
		private readonly List<CancellationTokenSource> tokens = new List<CancellationTokenSource>();

		private void OnEnable()
		{
			var t = target as DeployToGlitch;
			if (t == null) return;

			if (!t.TryGetComponent(out exp))
				exp = FindObjectOfType<ExportInfo>();

			if (!t.Glitch) t.Glitch = CreateInstance<GlitchModel>();
			var tok = new CancellationTokenSource();
			tokens.Add(tok);
			DeploymentUtils.UpdateGlitchProjectExists(t.Glitch, tok.Token);
		}

		private void OnDisable()
		{
			foreach (var tok in tokens) tok.Cancel();
			tokens.Clear();
		}

		private void OnValidate()
		{
			var t = target as DeployToGlitch;
			if (t && glitchProjectExists)
				DeploymentSecrets.TryAutomaticallyAssignDeployKeyIfNoneExistsYet(t.Glitch);
		}

		private static string lastProjectName = null;
		private static bool glitchProjectExists => DeploymentUtils.GlitchProjectExists == true || DeploymentUtils.GlitchProjectExists == null;
		private static bool glitchProjectIsResponding => DeploymentUtils.GlitchProjectIsResponding;

		public override void OnInspectorGUI()
		{
			if (!exp)
			{
				EditorGUILayout.HelpBox("Missing " + nameof(ExportInfo) + " component", MessageType.Warning);
				return;
			}

			if (!exp.Exists())
			{
				EditorGUILayout.HelpBox(
					"Deployment doesnt work without a project. Please create a project using the " + nameof(ExportInfo) + " component first.",
					MessageType.None);
				return;
			}

			var depl = target as DeployToGlitch;
			if (depl == null) return;

			using var ch = new EditorGUI.ChangeCheckScope();
			var glitchModel = depl.Glitch;

			if (glitchModel != null)
			{
				using (new EditorGUILayout.HorizontalScope())
				{
					EditorGUILayout.LabelField("Glitch", EditorStyles.boldLabel);
					DrawRemixOnGlitchButton(glitchModel);
				}
				EditorGUILayout.Space(2);

				DrawGlitchProjectName(glitchModel);

				if (string.IsNullOrWhiteSpace(glitchModel.ProjectName))
				{
					EditorGUILayout.Space(5);
					DrawDeployToGlitchInstructions();
				}

				if (!string.IsNullOrWhiteSpace(glitchModel.ProjectName))
				{
					DrawGlitchDeployKey(glitchModel, out var secret);
					
					if(!glitchProjectExists)
					{
						EditorGUILayout.Space(2);
						EditorGUILayout.HelpBox("Glitch project does not exist or is private, please make sure the project name is correct.", MessageType.Warning);
					}
					else if (!glitchProjectIsResponding)
					{
						EditorGUILayout.Space(2);
						EditorGUILayout.HelpBox("Glitch project does not respond. It might be waking up or take a few seconds if you've just remixed it.",
							MessageType.Warning);
					}

					if (string.IsNullOrWhiteSpace(secret))
					{
						EditorGUILayout.Space(2);
						if (DeploymentSecrets.IsCurrentlyRequestingDeployKey)
						{
							EditorGUILayout.HelpBox("Waiting for deployment key from Glitch, please stand by. You'll be all setup and ready to upload your project in just a few seconds!!!", MessageType.None);
						}
						else
						{
							if(glitchProjectExists)
								EditorGUILayout.HelpBox(
								"Missing deployment key: Deployment to glitch might get rejected! Open .env on glitch and enter a secret key, then paste the same key here into the \"Deploy Key\" field!",
								MessageType.Warning);
						}
					}

					if (DeployToGlitchUtils.IsCurrentlyDeploying)
					{
						EditorGUILayout.Space(2);
						using (new EditorGUILayout.HorizontalScope())
						{
							EditorGUILayout.HelpBox("Your project is currently being uploaded to Glitch! Please stand by...", MessageType.Info);
						}
					}

					if (exp && Directory.Exists(exp.GetProjectDirectory()))
					{
						EditorGUILayout.Space(5);
						EditorGUILayout.LabelField("Quick Actions", EditorStyles.boldLabel);
						var distributionDirectory = exp.GetProjectDirectory() + "/dist";

						using (new EditorGUI.DisabledScope(Actions.IsRunningBuildTask || !glitchProjectIsResponding))
						using (new EditorGUILayout.HorizontalScope())
						{
							var buttonOptions = new[] { GUILayout.Width(Screen.width * .5f - 13), GUILayout.Height(30) };
							var label = "Build & Deploy";
							var modifierKeyPressed = Event.current.modifiers == EventModifiers.Alt;
							var productionBuild = !NeedleEngineBuildOptions.DevelopmentBuild;
							if (modifierKeyPressed)
							{
								productionBuild = !productionBuild;
							}
							label += productionBuild ? ": Prod" : ": Dev";
							if (GUILayout.Button(new GUIContent(label, Assets.GlitchRemixIcon, NeedleEngineBuildOptions.DevelopmentBuild ? "Development Build (change in File / Build Settings or hold ALT to toggle temporarily)" : "Production Build (change in File / Build Settings or hold ALT to toggle temporarily)"), buttonOptions))
							{
								var buildContext = BuildContext.Distribution(productionBuild);
								buildContext.LiveUrl = DeployToGlitchUtils.GetProjectUrl(glitchModel.ProjectName);
								DeploymentActions.BuildAndDeployAsync(distributionDirectory, glitchModel.ProjectName, secret, buildContext, true);
								GUIUtility.ExitGUI();
							}
							var dirInfo = new DirectoryInfo(distributionDirectory);
							using (new EditorGUI.DisabledScope(!dirInfo.Exists || !dirInfo.EnumerateFiles().Any()))
							{
								if (GUILayout.Button(new GUIContent("Deploy Only", Assets.GlitchRemixIcon, "Deploy only will only upload the file in " + dirInfo.FullName + " - if you want to update your current website please click \"Build & Deploy\" instead."), buttonOptions))
								{
									var buildContext = BuildContext.PrepareDeploy;
									buildContext.LiveUrl = DeployToGlitchUtils.GetProjectUrl(glitchModel.ProjectName);
									DeploymentActions.BuildAndDeployAsync(distributionDirectory, glitchModel.ProjectName, secret, buildContext, true);
									GUIUtility.ExitGUI();
								}
							}
						}
						if (GUILayout.Button("Open in Browser " + Constants.ExternalLinkChar, GUILayout.Height(30)))
						{
							DeploymentActions.OpenInBrowser(glitchModel);
						}
					}
				}
			}

			if (ch.changed)
			{
				Undo.RegisterCompleteObjectUndo((Object)depl, "Editor deployment settings");
				DeploymentUtils.UpdateGlitchProjectExists(depl.Glitch);
				EditorUtility.SetDirty(target);
			}
		}

		public static void DrawGlitchProjectName(GlitchModel glitchModel)
		{
			if (glitchModel.serializedObject == null) glitchModel.serializedObject = new SerializedObject(glitchModel);
			glitchModel.serializedObject.Update();

			using (new EditorGUILayout.HorizontalScope())
			{
				EditorGUILayout.PropertyField(glitchModel.serializedObject.FindProperty(nameof(glitchModel.ProjectName)),
					new GUIContent("Project Name", "For example, my-great-app is the project name of my-great-app.glitch.me"));

				if(!string.IsNullOrWhiteSpace(glitchModel.ProjectName))
					glitchModel.ProjectName = glitchModel.ProjectName.Replace(" ", "");

				if (!string.IsNullOrWhiteSpace(glitchModel.ProjectName))
				{
					if (GUILayout.Button("Open", GUILayout.Width(45)))
					{
						Application.OpenURL(DeployToGlitchUtils.GetEditUrl(glitchModel.ProjectName, ""));
					}

					// var match = Regex.Match(glitchModel.ProjectName, @"(.*\/~?)?(?<projectname>[\w\-]+)\??.*");
					if (GlitchUtils.TryGetProjectName(glitchModel.ProjectName, out var projectName) && !Unsupported.IsDeveloperMode())
					{
						// var projectName = match.Groups["projectname"].Value;
						if (!string.IsNullOrWhiteSpace(projectName) && projectName != glitchModel.ProjectName)
						{
							glitchModel.ProjectName = projectName;
							GUIUtility.keyboardControl = -1;
						}
					}
				}
			}

			glitchModel.serializedObject.ApplyModifiedProperties();
			var projectNameChanged = glitchModel.ProjectName != lastProjectName;
			lastProjectName = glitchModel.ProjectName;

			if (glitchModel.IsValidProjectName())
			{
				if (projectNameChanged) 
					DeploymentUtils.UpdateGlitchProjectExists(glitchModel, default);
				DeploymentSecrets.TryAutomaticallyAssignDeployKeyIfNoneExistsYet(glitchModel);
			}
		}

		public static void DrawGlitchDeployKey(GlitchModel glitchModel, out string secret)
		{
			var lastRect = GUILayoutUtility.GetLastRect();
			lastRect.height = EditorGUIUtility.singleLineHeight * 1.2f;
			lastRect.y += EditorGUIUtility.singleLineHeight;
			lastRect.x = 0;
			lastRect.width = Screen.width;
			using (new EditorGUILayout.HorizontalScope())
			{
				var oldSecret = DeploymentSecrets.GetGlitchDeploymentKey(glitchModel.ProjectName);
				if (Event.current.modifiers == EventModifiers.Alt && lastRect.Contains(Event.current.mousePosition))
				{
					secret = oldSecret;
					EditorGUILayout.TextField("Deploy Key", oldSecret);
				}
				else
				{
					secret = EditorGUILayout.PasswordField(new GUIContent("Deploy Key","The deploy key must match the key on your glitch site in the \".env\" file to upload your project. Deploy keys are not shared/saved in a project but locally on your machine only!"), oldSecret);
				}
				if (!oldSecret.Equals(secret, StringComparison.Ordinal))
					DeploymentSecrets.SetGlitchDeploymentKey(glitchModel.ProjectName, secret);
				if (GUILayout.Button("Open", GUILayout.Width(45)))
				{
					Application.OpenURL(DeployToGlitchUtils.GetEditUrl(glitchModel.ProjectName, ".env"));
				}
			}
		}

		private static void DrawRemixOnGlitchButton(GlitchModel model)
		{
			if (GUILayout.Button( new GUIContent("Create new Glitch Remix", "Clicking this button will create a new remix on Glitch from the Needle Starter Template.")))
			{
				DeploymentActions.RemixAndOpenGlitchTemplate(model);
			}
		}

		public static void DrawDeployToGlitchInstructions()
		{
			EditorGUILayout.HelpBox("Instructions: \n" +
			                        "1) Click the \"Create new Glitch Remix\" button\n" +
			                        "2) Wait a moment for Glitch to remix...\n" +
			                        "3) Copy the URL of your Remix to the \"Project Name\" below", MessageType.None);
		}
	}
}