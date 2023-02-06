// #define UNITY_EDITOR_OSX 

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using JetBrains.Annotations;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Utils
{
	internal readonly struct TaskProcessInfo
	{
		public readonly string ProjectPath;
		public readonly string Cmd;

		public TaskProcessInfo(string path, string cmd)
		{
			this.ProjectPath = path;
			this.Cmd = cmd;
		}
	}

	public static class ProcessHelper
	{
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
		private static readonly List<string> npmSearchPathDirectories = new List<string>()
		{
			"/usr/local/bin/",
			"/usr/bin",
			"/bin",
			"/usr/sbin",
			"/sbin",
			"/opt/homebrew/bin"
		};
#endif
		// used for OSX and Linux
#pragma warning disable 067
		[UsedImplicitly] 
		internal static event Func<string, string> GetAdditionalNpmSearchPaths;
#pragma warning restore 067
		
		public static IEnumerable<string> RunCommandEnumerable(string command, string workingDirectory = null, CancellationToken cancel = default)
		{
			var si = CreateCommandProcessInfo(command, workingDirectory, null);
			var proc = new Process();
			proc.StartInfo = si;
			proc.Start();
			while (!proc.HasExited && !cancel.IsCancellationRequested)
			{
				if (si.RedirectStandardOutput)
				{
					do
					{
						var line = proc.StandardOutput.ReadLine();
						if (line == null) continue;
						yield return line;
					} while (proc.StandardOutput.Peek() >= 0 && !cancel.IsCancellationRequested);
				}
				if (si.RedirectStandardError)
				{
					do
					{
						var line = proc.StandardError.ReadLine();
						if (line == null) continue;
						yield return line;
					} while (proc.StandardError.Peek() >= 0 && !cancel.IsCancellationRequested);
				}
			}
		}

		public static async Task<bool> RunCommand(string command,
			string workingDirectory,
			string logFilePath = null,
			bool noWindow = true,
			bool logToConsole = true,
			int? parentId = -1,
			CancellationToken cancellationToken = default, 
			Action<LogType, string> onLog = null
		)
		{
			var isBackgroundProcess = parentId == null;
#if UNITY_EDITOR
			var name = command;
			var isInstallation = name.TrimEnd().Contains("npm install");
			if (isInstallation)
				name = "Installing ";
			var isRunServer = name.StartsWith("npm start");
			if (isRunServer)
				name = "Needle Engine Local Server ›";
			string progressDesc;
			if (!string.IsNullOrWhiteSpace(workingDirectory))
			{
				var dirInfo = new DirectoryInfo(workingDirectory);
				progressDesc = dirInfo.Name;
				if (isInstallation || isRunServer)
				{
					name += " " + dirInfo.Name;
					progressDesc = dirInfo.FullName;
				}
			}
			else
				progressDesc = "";
			if (isInstallation) name += "...";
			var opts = Progress.Options.Unmanaged;
			if (!isInstallation) opts |= Progress.Options.Indefinite;
			var progressId =  !isBackgroundProcess 
				? Progress.Start(name, progressDesc, opts, parentId.Value)
				: -1;
#endif

			var si = CreateCommandProcessInfo(command, workingDirectory, logFilePath, noWindow);

			Process proc;
			try
			{
				proc = Process.Start(si);
			}
			catch (InvalidOperationException e)
			{
				Debug.LogError("Can't start process " + command + ": " + e);
				throw;
			}

			var info = new TaskProcessInfo(workingDirectory, command);

#if UNITY_EDITOR
			if (!isBackgroundProcess)
			{
				ProgressHelper.SaveStartedProcess(proc?.Id ?? -1, command, progressId, name, progressDesc, workingDirectory);
				ProgressHelper.RegisterCancelCallback(progressId, info);
				PingUnityBackgroundProgress(proc, progressId, isInstallation);
			}
#endif

			// Progress.IsCancellable(progressId);
			// Progress.RegisterCancelCallback(progressId, () => 
			// {
			// 	Debug.Log(proc?.HasExited);
			//	TODO: this is not enough, we need to kill spawned child processes as well
			// 	if (proc != null && !proc.HasExited)
			// 	{
			// 		proc.Kill();
			// 	}
			// 	return true;
			// });

			var hasErrors = false;
			var lastLineWasEmpty = false;
			var t1 = Task.Run(async () =>
			{
				#if UNITY_EDITOR_WIN
				// read asynchronously: seems that npm resets cursor position instead of writing proper lines,
				// which is why ReadLineAsync() only gets the last line (when a line end has actually been written)
				if (proc != null && !proc.HasExited && si.RedirectStandardError)
				{
					proc.OutputDataReceived += OnMessage;
					proc.ErrorDataReceived += OnMessage;
					proc.BeginOutputReadLine();
					proc.BeginErrorReadLine();
					void OnMessage(object sender, DataReceivedEventArgs args)
					{
						SendLineToConsole(args.Data, workingDirectory, ref lastLineWasEmpty, ref hasErrors, logToConsole);
					}
				}

				// wait for process completion
				while (true)
				{
					if (proc == null) break;
					if (proc.HasExited) break;
					if (cancellationToken.IsCancellationRequested) break;
					// await Task.Yield();
					await Task.Delay(100, cancellationToken);
				}
				#else 
				// on OSX the method used above doesnt work but readback async does
				while (true)
				{
					if (proc == null) break;
					if (si.RedirectStandardOutput)
					{
						do
						{
							var output = await proc.StandardOutput.ReadLineAsync();
							SendLineToConsole(output, workingDirectory, ref lastLineWasEmpty, ref hasErrors, logToConsole);
							onLog?.Invoke(LogType.Log, output);
						} while (proc.StandardOutput.Peek() >= 0);
					}
					if (si.RedirectStandardError)
					{
						do
						{
							var output = await proc.StandardError.ReadLineAsync();
							SendLineToConsole(output, workingDirectory, ref lastLineWasEmpty, ref hasErrors, logToConsole);
							onLog?.Invoke(LogType.Error, output);
						} while (proc.StandardError.Peek() >= 0);
					}
					if (cancellationToken.IsCancellationRequested) break;
					if (proc.HasExited) break;
					await Task.Delay(50, cancellationToken);
				}
				// Debug.Log(await proc.StandardOutput.ReadToEndAsync());
				// Debug.LogError(await proc.StandardError.ReadToEndAsync());
				#endif
			}, cancellationToken);
			
			var t2 = Task.Run(async () =>
			{
				if (logFilePath != null)
				{
					await Task.Delay(1000, cancellationToken);
					if (File.Exists(logFilePath))
						ContinuouslyReadFileAndLog(logFilePath, workingDirectory, ref lastLineWasEmpty, ref hasErrors, proc, logToConsole);
				}
			}, cancellationToken);
			// if we're publishing try get the npm log and read that back
			Task t3 = default;
			if (command.Contains("npm publish"))
			{
				t3 = Task.Run(async () =>
				{
					await Task.Delay(1000, cancellationToken);
					if (!NpmLogCapture.GetLastLogFileCreated(out var logFile, 2)) return;
					if (logFile != null && File.Exists(logFile))
						ContinuouslyReadFileAndLog(logFile, workingDirectory, ref lastLineWasEmpty, ref hasErrors, proc, logToConsole);
				}, cancellationToken);
			}
			var tasks = new List<Task> { t1, t2 };
			if (t3 != null) tasks.Add(t3);
			await Task.WhenAll(tasks);

			if (cancellationToken.IsCancellationRequested)
			{
				CancelTask(info);
			}

#if UNITY_EDITOR
			// we might be on a background thread
			if (!isBackgroundProcess && Progress.Exists(progressId))
				Progress.Finish(progressId, hasErrors ? Progress.Status.Failed : Progress.Status.Succeeded);
#endif
			return !hasErrors;
		}

		internal static ProcessStartInfo CreateCommandProcessInfo(string command, string workingDirectory = null, string logFilePath = null, bool noWindow = true)
		{
			var si = new ProcessStartInfo();
			if (workingDirectory != null)
				si.WorkingDirectory = workingDirectory;
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
			noWindow = true;
#if UNITY_EDITOR_LINUX
			si.FileName = "sh";
#else
			si.FileName = "zsh";
#endif
			var isNpmCommand = command.IndexOf("npm", StringComparison.Ordinal) >= 0;
			if (isNpmCommand && !command.Contains("`which npm`"))
			{
				// for linux?
				// command = command.Replace("npm ", "\"`which npm`\" ");
				command = command.Replace("npm ", "`which npm` ");
			}
			var isNodeCommand = command.IndexOf("node", StringComparison.Ordinal) >= 0;
			if (isNodeCommand && !command.Contains("`which node`"))
			{
				command = command.Replace("node ", "`which node` ");
			}
			
			si.Arguments = $"-c '{command}'";
			if (noWindow && (isNpmCommand || isNodeCommand))
			{
				var path = GetAdditionalNpmSearchPaths?.Invoke(":");
				if (path == null) path = "";
				else if(!string.IsNullOrWhiteSpace(path)) path += ":";
				path += string.Join(":", npmSearchPathDirectories);
				si.Environment.Add("PATH", path);
				//Debug.Log($"Setting PATH to {path}");
			}
#else
			si.FileName = "cmd.exe";
			si.Arguments = $"/c {command}";
#endif

			if (logFilePath != null)
				si.Arguments += $" 2>&1 > \"{logFilePath}\"";
			
			if (noWindow)
			{
				si.UseShellExecute = false;
				si.CreateNoWindow = true;
				si.RedirectStandardOutput = true;
				si.RedirectStandardError = true;
			}
			return si;
		}

		internal static async void PingUnityBackgroundProgress(Process proc, int progressId, bool isInstallation, bool finishOnExit = true)
		{
#if UNITY_EDITOR
			var t01 = 0.01f;
			var interval = isInstallation ? 100 : 200;
			while (true)
			{
				if (proc == null || proc.HasExited) break;
				if (!Progress.Exists(progressId)) break;
				Progress.Report(progressId, t01);
				if (isInstallation) t01 = (t01 + .1f) % 1.00001f;
				else t01 += 0.01f * (1 - t01);
				await Task.Delay(interval);
			}
			if (finishOnExit && Progress.Exists(progressId))
				Progress.Finish(progressId);
#else
			await Task.CompletedTask;
#endif
		}

		// private static async Task<bool> WatchProcess(Process proc)
		// {
		// }

		internal static bool CancelTask(TaskProcessInfo info)
		{
#if UNITY_EDITOR_OSX || UNITY_EDITOR_LINUX
			var killed = false;
			// we kill all node processes on osx when requested
			// since they might have child processes that we dont know about
			// im not sure how we can get them
			// and we dont have a way to access to process command line args right now
			if (ProcessUtils.TryFindNodeProcesses(out var list))
			{
				foreach (var pi in list)
				{
					if (pi.CommandLine?.Contains(info.ProjectPath) == true)
					{
						if (pi.Process?.HasExited == false)
						{
							killed = true;
							pi.Process.Kill();
						}
					}
				}
			}
			// killing only the started processes is not enough
			// e.g. the command that starts the server spawns a child process
			// which is not found with this approach
			// foreach (var started in ProgressHelper.GetStartedAndRunningProcesses())
			// {
			// 	Debug.Log("Kill: " + started.Id + ", " + started.ProcessName);
			// 	killed = true;
			// 	started.Kill();
			// }
			return killed;
#else
			var projectPath = info.ProjectPath;
			var cmd = info.Cmd;
			if (projectPath != null)
			{
				projectPath = projectPath.Replace("/", "\\");
			}
			var commands = cmd.Split('&')
				.Where(e => !string.IsNullOrWhiteSpace(e))
				.Select(c => c.Replace("npm", "").Trim())
				.ToArray();
			if (ProcessUtils.KillNodeProcesses(commandLine =>
			    {
				    if (projectPath != null && commandLine.Contains(projectPath)) return true;
				    return commands.Any(s => commandLine.EndsWith(s));
			    }))
			{
				return true;
			}
			return false;
#endif
		}

		private static void ContinuouslyReadFileAndLog(
			string file,
			string workingDirectory,
			ref bool lastLineWasEmpty,
			ref bool hasErrors,
			Process proc,
			bool logToConsole)
		{
			using var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
			using var reader = new StreamReader(stream, Encoding.UTF8);
			while (true)
			{
				do
				{
					var line = reader.ReadLine();
					if (line != null)
						SendLineToConsole(line, workingDirectory, ref lastLineWasEmpty, ref hasErrors, logToConsole);
				} while (reader.Peek() > 0);
				if (proc == null || proc.HasExited) break;
				Thread.Sleep(300);
			}
		}

		private static void SendLineToConsole(string line, string path, ref bool lastLineWasEmpty, ref bool hasErrors, bool logToConsole = true)
		{
			if (string.IsNullOrWhiteSpace(line))
			{
				// if (lastLineWasEmpty)
				return;
				// lastLineWasEmpty = true;
			}
			// else lastLineWasEmpty = false;

			// if (line == null) return;

			// line = urlRegex.Replace(line, ev =>
			// {
			// 	var url = ev.Groups["url"];
			// 	return "<a href=\"" + url.Value + "\">" + url + "</a>";
			// });

			if (logToConsole)
				TryMakePathsClickable(ref line);

			if (line.StartsWith("node: bad option: --no-experimental-fetch"))
			{
				if (logToConsole)
				{
					Debug.LogFormat(LogType.Warning, LogOption.NoStacktrace, null, "{0}", line);
					Debug.LogError(
						$"No experimental fetch is not supported in this version of node. Please update node to a more recent version (it was added in Node 18 but is also available in later versions of Node 16. See {"https://nodejs.org/api/cli.html#--no-experimental-fetch".AsLink()}.\nUpdate node: {"https://nodejs.org/en/download/".AsLink()}\n");
				}
			}
			else if (line.Contains("silly logfile error") || line.StartsWith("Missing optional extension,"))
			{
				if (logToConsole)
					Debug.LogFormat(LogType.Warning, LogOption.NoStacktrace, null, "{0}", line);
			}
			else if (line.Contains("command not found:") || line.Contains("'npm' is not recognized") || line.Contains("command not found: npm") || line.Contains("'npm' wird nicht als interner oder externer Befehl") ||
			    line.Contains("The system cannot find the path specified.") || line.Contains("'toktx' is not recognized") || line.Contains("command not found: toktx") || line.StartsWith("node: bad option:") || line.Contains("'tsc' is not recognized") || line.Contains("This is not the tsc command you are looking for"))
			{
				if (logToConsole)
					Debug.LogFormat(LogType.Error, LogOption.NoStacktrace, null, "{0}", line);
				hasErrors = true;
				// var msg = ">> <b>Please install nodejs</b> - if you recently installed nodejs make sure to restart Unity and/or your computer.";
				// Debug.LogFormat(LogType.Warning, LogOption.NoStacktrace, null, "{0}", msg);
			}
			// else if (line.StartsWith("npm WARN enoent ENOENT: no such file"))
			// {
			// 	// there's a bazillion of these when installing modules...
			// }
			else if ((line.Contains("error ") == false && line.Contains("not exported")) || line.Contains("(!)") || line.StartsWith("npm WARN") || line.TrimStart().StartsWith("WARN") || line.Contains("is not recognized as an internal or external command") || line.Contains(" are NPOT, and may fail in older APIs (including WebGL 1.0) on certain devices."))
			{
				if (line.StartsWith("npm WARN using --force"))
				{
					// ignore
				}
				else if (logToConsole)
					Debug.LogFormat(LogType.Warning, LogOption.NoStacktrace, null, "{0}", line);
			}
			else if (line.Contains(" error ") || line.StartsWith("error ") || line.StartsWith("Error: ") || line.Contains("Could not ") || line.StartsWith("npm ERR!") || line.Contains("failed to resolve") || line.TrimStart().StartsWith("ERR:"))
			{
				hasErrors = true;
				var logPath = GetFilePath(line);
				var log = line;
				if (logPath != null)
				{
					var fullPath = path + "/" + logPath;
					log += $"\n<a href=\"{fullPath}\">Open {fullPath}</a>";
				}
				if (logToConsole)
					Debug.LogFormat(LogType.Error, LogOption.NoStacktrace, null, "{0}", log);
			}
			else if (logToConsole)
				Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, null, "{0}", line);
		}

		private static string GetFilePath(string log)
		{
			var index = log.IndexOf("(", StringComparison.Ordinal);
			if (index > 0)
			{
				return log.Substring(0, index);
			}
			return null;
		}

		private static void TryMakePathsClickable(ref string line)
		{
			bool tryFindPath(ref string line, string start, string end, bool appendStart = false, bool appendEnd = false)
			{
				var importStartIndex = line.IndexOf(start, StringComparison.Ordinal);
				var importEndIndex = line.LastIndexOf(end, StringComparison.Ordinal);
				if (importStartIndex >= 0 && importEndIndex > 0)
				{
					importStartIndex += start.Length;
					var path = line.Substring(importStartIndex, importEndIndex - importStartIndex);
					if (appendStart) path = start + path;
					if (appendEnd) path += end;
					if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
					{
						var href = "<a href=\"" + path + "\">" + path + "</a>";
						line = line.Replace(path, href);
						return true;
					}
				}
				return false;
			}

			if (tryFindPath(ref line, "(imported by ", ")")) return;
			if (tryFindPath(ref line, " open '", "'")) return;
			if (tryFindPath(ref line, "C:\\Users\\", ".log", true, true)) return;
		}
	}
}