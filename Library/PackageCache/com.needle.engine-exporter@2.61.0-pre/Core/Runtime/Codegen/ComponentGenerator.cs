using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Codegen
{
	internal struct ComponentGenerationInfo
	{
		public string SourceDirectory;
		public string TargetDirectory;
		public bool IncludeSubDirectories;
	}

	internal struct FileChangedInfo
	{
		public string Path;
		public WatcherChangeTypes ChangeType;
	}
	
	[RequireComponent(typeof(ExportInfo))]
	[ExecuteAlways]
	[HelpURL(Constants.DocumentationComponentGenerator)]
	public class ComponentGenerator : MonoBehaviour
	{
		[HideInInspector] public string compilerDirectory = "";

		public bool Debug;

#if UNITY_EDITOR
		private const string compilerFileName = "component-compiler.js";
		public string FullCompilerPath => compilerDirectory + "/" + compilerFileName;

		public bool FileWatcherIsActive => watcher?.HasWatchers() == true;

		[InitializeOnLoadMethod]
		private static void Init()
		{
			var comp = Object.FindObjectOfType<ComponentGenerator>();
			if (comp)
			{
				comp.UpdateWatcher();

				async void CheckThatWatcherIsRunning()
				{
					var lastUpdate = DateTime.Now;
					var lastProjectDirectory = "";
					while (true)
					{
						if (!comp) return;
						if (comp.watcher == null || comp.watcher.HasWatchers() == false) 
							comp.UpdateWatcher();
						else if ((DateTime.Now - lastUpdate).Minutes >= 1)
						{
							// Make sure we update the watcher when the project directory changes
							var exportInfo = FindObjectOfType<ExportInfo>();
							if (exportInfo && exportInfo.DirectoryName != lastProjectDirectory)
							{
								lastUpdate = DateTime.Now;
								comp.UpdateWatcher();
							}
						}
						await Task.Delay(2000);
					}
				}
				CheckThatWatcherIsRunning();
			}
		}

		// ReSharper disable once Unity.RedundantEventFunction
		private void OnEnable()
		{
			// to be able to disable this component
			OnValidate();
		}

		private void OnDisable()
		{
			StopWatching();
		}

		private void OnValidate()
		{
			if (!this) return;
			watcher?.Dispose();
			watcher = null;
			this.UpdateWatcher();
		}

		private readonly ProjectScriptDirectoryProvider scriptsPathProvider = new ProjectScriptDirectoryProvider();
		// internal string[] WatchedDirectories { get; } = Array.Empty<string>();
		private CodeWatcher watcher;


		private void StopWatching()
		{
			watcher?.StopWatch();
		}

		internal void UpdateWatcher()
		{
			watcher?.StopWatch();
			var dir = scriptsPathProvider.GetScriptsDirectory(this);
			if (dir != null)
			{
				watcher ??= new CodeWatcher("Assets/Needle/Components.codegen", this.FullCompilerPath);
				watcher.BeginWatch(dir);
			}
			if(watcher != null)
				watcher.DebugCompiler = Debug;
			// TODO: currently components generator does not delete old generated components
		}

		internal bool TryFindCompilerDirectory(Dictionary<string, string> deps)
		{
			if (Directory.Exists(compilerDirectory))
			{
				return true;
			}
			if (deps != null)
			{
				var exp = FindObjectOfType<ExportInfo>();
				if (deps.TryGetValue("@needle-tools/needle-component-compiler", out var val))
				{
					if (PackageUtils.TryGetPath( exp.GetProjectDirectory(), val, out var fullPath))
					{
						compilerDirectory = fullPath + "/src";
						return true;
					}
				}
				
				// fallback to needle engine compiler installation
				compilerDirectory = $"{exp.GetProjectDirectory()}/node_modules/{Constants.RuntimeNpmPackageName}/node_modules/@needle-tools/needle-component-compiler/src";
				return true;
			}
			return false;
		}

#endif
	}
}