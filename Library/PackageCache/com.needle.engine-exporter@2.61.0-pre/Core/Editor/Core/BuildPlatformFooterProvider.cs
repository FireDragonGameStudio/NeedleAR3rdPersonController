using System;
using JetBrains.Annotations;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core
{
	internal class BuildPlatformToktx : INeedleBuildPlatformGUIProvider
	{
		private static DateTime lastTimeToktxVersionChecked;
		private static bool toktxValid = true;
		
		public void OnGUI(NeedleEngineBuildOptions buildOptions)
		{
			if (NeedleEngineBuildOptions.DevelopmentBuild == false)
			{
				var now = DateTime.Now;
				if (now - lastTimeToktxVersionChecked > TimeSpan.FromSeconds(10))
				{
					lastTimeToktxVersionChecked = now;
					toktxValid = Actions.HasMinimumToktxVersionInstalled();
				}
				if (!toktxValid)
				{
					using (new EditorGUILayout.HorizontalScope())
					{
						EditorGUILayout.HelpBox("Minimum recommended toktx version is not installed. Please download and install the recommend version for making production builds (or tick the Development Build checkbox above)", MessageType.Warning);
						if (GUILayout.Button("Download toktx installer", GUILayout.Height(38)))
						{
							InternalActions.DownloadAndInstallToktx();
						}
					}
					GUILayout.Space(16);
				}
			}
		}

	}
	
	[UsedImplicitly]
	internal class BuildPlatformFooterProvider : INeedleBuildPlatformFooterGUIProvider
	{
		
		public void OnGUI(NeedleEngineBuildOptions buildOptions)
		{
			using (new EditorGUI.DisabledScope(Actions.IsRunningBuildTask))
			{
				var exp = Object.FindObjectOfType<ExportInfo>();
				if (!exp)
				{
					if (GUILayout.Button("Make Project Needle Engine Compatible"))
					{
						var go = new GameObject("Needle Engine Export");
						go.tag = "EditorOnly";
						go.AddComponent<ExportInfo>();
					}
				}
				else
				{
					const float width = BuildPlatformConstants.LeftColumnWidth;
					
					if (GUILayout.Button(new GUIContent("Build"), GUILayout.Width(width)))
					{
						MenuItems.BuildForDist(NeedleEngineBuildOptions.DevelopmentBuild ? BuildContext.Development : BuildContext.Production);
						GUIUtility.ExitGUI();
					}
					if (GUILayout.Button("Run in browser", GUILayout.Width(width)))
					{
						RunInBrowser();
						GUIUtility.ExitGUI();
					}
				}
			}
		}

		private static async void RunInBrowser()
		{
			await Builder.Build(false, BuildContext.LocalDevelopment);
			MenuItems.StartDevelopmentServer();
		}
	}
}