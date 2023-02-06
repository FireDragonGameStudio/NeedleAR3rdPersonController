using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Projects;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	internal static class EnterPlayMode
	{
		internal static event Func<bool> OverridePlayModeNotInExportScene;

		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorApplication.playModeStateChanged += OnPlayModeChanged;
		}

		private static bool isWaitingToRun = false;

		private static void OnPlayModeChanged(PlayModeStateChange obj)
		{
			if (ExporterProjectSettings.instance.overrideEnterPlaymode)
			{
				if (obj == PlayModeStateChange.ExitingEditMode)
				{
					if (ExporterProjectSettings.instance.overrideEnterPlaymode)
					{
						Play();
					}
				}
			}
		}

		internal static void Play()
		{
			var info = Object.FindObjectOfType<ExportInfo>();
			var exitPlayMode = ExporterProjectSettings.instance.overrideEnterPlaymode;

			if (info != null)
			{
				if (exitPlayMode)
					EditorApplication.ExitPlaymode();
				Play(info);
			}
			else
			{
				if (OverridePlayModeNotInExportScene?.Invoke() ?? false)
				{
					if (exitPlayMode)
						EditorApplication.ExitPlaymode();
				}
			}
		}

		private static async void Play(IProjectInfo info)
		{
			if (info != null)
			{
				var wasInAnimationPreviewMode = AnimationWindowUtil.IsPreviewing();
				if (wasInAnimationPreviewMode) AnimationWindowUtil.StopPreview();

				if (isWaitingToRun)
				{
					if (Actions.IsInstalling())
						Debug.LogWarning(
							"Project is installing... please wait a moment, it will run automatically once installed");
					else
						Debug.LogWarning("Project is building...");
					return;
				}
				isWaitingToRun = true;
				try
				{
					if ((info.Exists() && !info.IsInstalled()) || !Actions.LocalPackagesAreInstalled())
					{
						await Actions.RunProjectSetup(
							Actions.PathType.NeedleRuntimePackage | Actions.PathType.LocalThreejs, true);
					}

					if (!info.Exists())
					{
						var projectDir = info.ProjectDirectory;
						var template =
							ProjectGenerator.Templates.FirstOrDefault(v => v.name.ToLowerInvariant().Contains("vite"));
						var isTemporaryProject = (info as ExportInfo)?.IsTempProject() ?? false;
						if (!string.IsNullOrWhiteSpace(projectDir) && template != null && (isTemporaryProject ||
							    EditorUtility.DisplayDialog("Missing project",
								    $"A project does not exist, do you want to create a project using the template \"{template.name}\" now at {Path.GetFullPath(projectDir)}?",
								    $"Yes, create project from template", "No, do nothing")))
						{
							await ProjectGenerator.CreateFromTemplate(projectDir, template);
						}
						else
						{
							var exportComp = Object.FindObjectOfType<ExportInfo>();
							const string msg0 =
								"<b>Can't run: missing project</b>, please generate a new project or select an existing project.";
							const string msg1 = "Select the " +
							                    nameof(ExportInfo) +
							                    " component, choose a template and click <i>Generate Project</i>";
							var warning = msg0;
							if (exportComp) warning = $"{msg0} {msg1}";
							Debug.LogWarning(warning, exportComp);
							if (exportComp)
								EditorGUIUtility.PingObject(exportComp);
							return;
						}
					}

					var res = await Builder.Build(false, BuildContext.LocalDevelopment);
					if (res)
					{
						await Task.Delay(1000);
						MenuItems.StartDevelopmentServer(info, true);
					}
				}
				finally
				{
					isWaitingToRun = false;
					if (wasInAnimationPreviewMode) AnimationWindowUtil.StartPreview();
				}
			}
		}
	}
}