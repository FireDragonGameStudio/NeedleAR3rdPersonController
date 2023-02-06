using System.IO;
using Needle.Engine.Core;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	public class BuildWindowDeployOptions : INeedleBuildPlatformGUIProvider
	{
		public void OnGUI(NeedleEngineBuildOptions options)
		{
			var exp = Object.FindObjectOfType<ExportInfo>();
			if (!exp) return;

			var depl = Object.FindObjectOfType<DeployToGlitch>();
			GlitchModel model = default;
			if (depl)
			{
				depl.Glitch ??= ScriptableObject.CreateInstance<GlitchModel>();
				model = depl.Glitch;
			}

			using(new EditorGUI.DisabledScope(Actions.IsRunningBuildTask))
			using (var change = new EditorGUI.ChangeCheckScope())
			using (new EditorGUILayout.HorizontalScope())
			{
				using (new EditorGUILayout.VerticalScope())
				{
					var buttonOptions = new GUILayoutOption[] { GUILayout.Height(36), GUILayout.Width(150) };
					var requireRemix = !depl || string.IsNullOrEmpty(depl.Glitch.ProjectName);

					var secret = model != null ? DeploymentSecrets.GetGlitchDeploymentKey(model.ProjectName) : default;
					var dist = exp.GetProjectDirectory() + "/dist";
					var hasSecret = !string.IsNullOrEmpty(secret);
					var canDeploy = Directory.Exists(dist) && hasSecret;
					
					if (requireRemix)
					{
						if (GUILayout.Button(new GUIContent("Remix on Glitch", Assets.GlitchRemixIcon), buttonOptions))
						{
							if (!depl)
							{
								exp.gameObject.AddComponent<DeployToGlitch>();
							}
							DeploymentActions.RemixAndOpenGlitchTemplate(model);
						}
					}
					else
					{
						using (new EditorGUI.DisabledScope(model == null || !hasSecret))
						{
							if (GUILayout.Button(new GUIContent("Build & Deploy", Assets.GlitchRemixIcon, !hasSecret ? "Missing deployment secret" : ""), buttonOptions))
							{
								DeploymentActions.BuildAndDeployAsync(dist, model?.ProjectName, secret, NeedleEngineBuildOptions.DevelopmentBuild ? BuildContext.Development : BuildContext.Production, true);
								GUIUtility.ExitGUI();
							}
						}
					}


					using (new EditorGUI.DisabledScope(model == null || string.IsNullOrWhiteSpace(model.ProjectName)))
					{
						using (new GUILayout.HorizontalScope())
						{
							using (new EditorGUI.DisabledScope(!canDeploy))
							{
								if (GUILayout.Button("Deploy") && model != null)
								{
									DeploymentActions.DeployAsync(dist, model.ProjectName, secret, BuildContext.PrepareDeploy, true);
									GUIUtility.ExitGUI();
								}
							}
							if (GUILayout.Button("Open " + Constants.ExternalLinkChar) && model != null)
							{
								DeploymentActions.OpenInBrowser(model);
							}
						}
					}
				}

				using (new EditorGUILayout.VerticalScope())
				{
					var main = EditorStyles.wordWrappedLabel;
					EditorGUILayout.LabelField(new GUIContent("Deploy your Unity project to Glitch in seconds: " +
					                                          "Click the \"Remix on Glitch\" button, add a secret and click Build & Deploy to upload your website!"),
						main);
					// var mini = EditorStyles.wordWrappedMiniLabel;
					// EditorGUILayout.LabelField("Deploy your Unity project to Glitch with just one click.\n" +
					//                            "Click the \"Remix on Glitch\" button and share your 3d web experience in just a few seconds!", mini);

					if (depl && model != null)
					{
						EditorGUILayout.Space(3);
						using (new LabelWidthScope(90))
						{
							DeployToGlitchEditor.DrawGlitchProjectName(model);
							if (!string.IsNullOrEmpty(model.ProjectName))
								DeployToGlitchEditor.DrawGlitchDeployKey(model, out _);
						}
					}

					// using (new EditorGUILayout.HorizontalScope())
					// {
					// 	// GUILayout.FlexibleSpace();
					// }
				}

				if (change.changed)
				{
					if (depl)
					{
						EditorUtility.SetDirty(depl);
						Undo.RegisterCompleteObjectUndo((Object)depl, "Edited deployment options");
					}
				}
			}
		}
	}
}