using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Codegen
{
	public class CodeWatcher : IDisposable
	{
		public string GeneratorPath => _generatorPath;
		public string CodeGenDirectory => _codeGenDirectory;

		public bool DebugCompiler;

		public static bool TryGetComponentGeneratorVersion(out string ver)
		{
			const string path = Constants.RuntimeNpmPackagePath + "/node_modules/@needle-tools/needle-component-compiler/package.json";
			return PackageUtils.TryGetVersion(path, out ver);
		}

		private static readonly string[] extensionsToWatch = { "*.ts", "*.js" };

		private static ComponentGeneratorRunner _runner;
		private readonly List<FileSystemWatcher> _watchers = new List<FileSystemWatcher>();
		private readonly string _codeGenDirectory;
		private string _generatorPath;
		private string _generatorDir;
		private readonly object _changedFilesLock = new object();
		private readonly List<string> _changedFiles = new List<string>();
		private readonly string seed;

#if UNITY_EDITOR
		public event Action<string, bool> AfterRun;
		public event Action<string> Changed;
#endif

		public CodeWatcher(string codegenDir, string generatorPath = null, string seed = null)
		{
#if UNITY_EDITOR
			this._codeGenDirectory = codegenDir;
			_runner = new ComponentGeneratorRunner();
			this.seed = seed;
			UpdateGeneratorPath();
#endif
		}

		private void UpdateGeneratorPath()
		{
			var generatorPath = Constants.RuntimeNpmPackagePath + "/node_modules/@needle-tools/needle-component-compiler/src/component-compiler.js";
			this._generatorPath = Path.GetFullPath(generatorPath);
			this._generatorDir = Path.GetDirectoryName(generatorPath);
		}

		public bool HasWatchers() => _watchers.Count > 0;

		public void BeginWatch(string path)
		{
#if UNITY_EDITOR
			if (!Directory.Exists(path)) return;
			if (!File.Exists(_generatorPath))
			{
				// the directory might not exist when the project is not (yet) installed
				UpdateGeneratorPath();
				return;
			}
			for (var i = 0; i < extensionsToWatch.Length; i++)
			{
				var watcher = new FileSystemWatcher();
				_watchers.Add(watcher);
				watcher.Path = path;
				watcher.Filter = extensionsToWatch[i];
				watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime;
				watcher.Deleted -= OnChanged;
				watcher.Created -= OnChanged;
				watcher.Changed -= OnChanged;

				watcher.Deleted += OnChanged;
				watcher.Changed += OnChanged;
				watcher.Created += OnChanged;
				watcher.EnableRaisingEvents = true;
				// because we dont want to watch e.g. node_modules
				watcher.IncludeSubdirectories = false;
			}
#endif
		}

		public void StopWatch()
		{
			this.Dispose();
		}

		public void RunFor(string filePath)
		{
#if UNITY_EDITOR
			InternalAdd(filePath);
#endif
		}

#if UNITY_EDITOR
		private int _changeEventId = 0;

		private void OnChanged(object sender, FileSystemEventArgs e)
		{
			switch (e.ChangeType)
			{
				case WatcherChangeTypes.Deleted:
					var fp = e.FullPath;

					void MainEventChanged()
					{
						Debug.Log("File deleted: " + fp);
						EditorApplication.update -= MainEventChanged;
						Changed?.Invoke(fp);
					}

					EditorApplication.update += MainEventChanged;
					// InternalEditorUtility.RepaintAllViews();
					break;

				case WatcherChangeTypes.Changed:
				case WatcherChangeTypes.Created:
					InternalAdd(e.FullPath);
					break;
			}
		}

		private async void InternalAdd(string filePath)
		{
			lock (_changedFilesLock)
			{
				if (_changedFiles.Contains(filePath)) return;
				_changedFiles.Add(filePath);
			}

			var evt = ++_changeEventId;
			await Task.Delay(300);
			if (evt != this._changeEventId) return;

			// schedule on main thread and force update
			EditorApplication.update -= ProcessChangedFiles;
			EditorApplication.update += ProcessChangedFiles;
			// InternalEditorUtility.RepaintAllViews();
		}

		private async void ProcessChangedFiles()
		{
			try
			{
				string[] files;
				lock (_changedFilesLock)
				{
					files = this._changedFiles.Distinct().ToArray();
					_changedFiles.Clear();
				}

				foreach (var file in files)
				{
					_runner.debug = DebugCompiler;
					var res = await _runner.Run(this._generatorDir, file, this._codeGenDirectory, this.seed);
					AfterRun?.Invoke(file, res);
					if (res) Changed?.Invoke(file);
				}
			}
			catch (Exception e)
			{
				Debug.LogException(e);
				lock (_changedFilesLock)
				{
					_changedFiles.Clear();
				}
			}
		}
#endif

		public void Dispose()
		{
			foreach (var watcher in _watchers) watcher.Dispose();
			_watchers.Clear();
		}
	}
}