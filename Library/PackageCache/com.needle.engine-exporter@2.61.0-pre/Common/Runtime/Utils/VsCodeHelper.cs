using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using UnityEditor;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Utils
{
	internal static class VsCodeHelper
	{
		private const string WindowsUrl = "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user";
		private const string OSXUrl = "https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal";
		private const string OSXUrlArm = "https://code.visualstudio.com/sha/download?build=stable&os=darwin-arm64";

		internal static Task<string> DownloadVsCode()
		{
			var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
			var isArm = RuntimeInformation.ProcessArchitecture == Architecture.Arm64;
			var url = isWindows ? WindowsUrl : isArm ? OSXUrlArm : OSXUrl;
			// download for osx is zip
			var extension = default(string);
			if (!isWindows) extension = ".zip";
			Debug.Log("Begin downloading vscode");
			return DownloadHelper.Download(url, "vscode", extension);
		}

		internal static async Task<string> DownloadAndInstallVSCode()
		{
			var path = await DownloadVsCode();
			if (File.Exists(path))
			{
				Debug.Log("Install VSCode");
				var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
				if (isWindows)
				{
					try
					{
						Process.Start(path);
						return path;
					}
					catch (Win32Exception ex)
					{
						if (ex.Message.Contains("canceled")) Debug.Log("VsCode installation cancelled");
						else Debug.LogException(ex);
					}
				}
				else
				{
					Debug.Log("Please save VSCode to Applications/Visual Studio Code.app");
#if UNITY_EDITOR
					EditorUtility.RevealInFinder(path);
#endif
					return path;
					// unzip
					// await ProcessHelper.RunCommand("unzip " + path, Path.GetDirectoryName(path));
					// var newPath = "/Applications/Visual Studio Code.app";
					// Process.Start("open", newPath);
// 					if (path.EndsWith(".zip"))
// 					{
// 						Debug.Log("Unzip vscode");
// 						var unzippedPath = Path.GetDirectoryName(path) + "/Visual Studio Code.app";
// 						if (File.Exists(unzippedPath)) File.Delete(unzippedPath);
// 						ZipFile.ExtractToDirectory(path, Path.GetDirectoryName(path));
// 						path = unzippedPath;
// 					}
// 					// open downloaded file
// 					// Process.Start("open", path);
// 					// return path;
// 					var appsDir = "/Applications";
// 					var newPath = Path.Combine(appsDir, "Visual Studio Code.app");
// 					var allowMove = true;
// 					if (File.Exists(newPath))
// 					{
// #if UNITY_EDITOR
// 						var res = EditorUtility.DisplayDialog("VSCode already installed", $"VSCode is already installed at {newPath}", "Override", "Cancel");
// 						allowMove &= res;
// 						if (!res)
// 							Debug.Log("VsCode installation cancelled - will attempt opening the already installed vscode application");
// 						else File.Delete(newPath);
// #endif
// 					}
// 					if (allowMove)
// 					{
// 						Debug.Log("Move VSCode to " + newPath);
// 						File.Move(path, newPath);
// 					}
// 					// open downloaded app via terminal command
// 					try
// 					{
// 						Process.Start(newPath);
// 						return newPath;
// 					}
// 					catch (Win32Exception ex)
// 					{
// 						if (ex.Message.Contains("canceled")) Debug.Log("VsCode installation cancelled");
// 						else Debug.LogException(ex);
// 					}
// 					return newPath;
				}
			}
			return null;
		}
	}
}