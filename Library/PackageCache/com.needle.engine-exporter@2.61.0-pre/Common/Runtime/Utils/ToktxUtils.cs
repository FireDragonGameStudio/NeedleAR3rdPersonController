using System;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal static class ToktxUtils
	{
		public const string TokTxWinUrl = "https://fwd.needle.tools/needle-engine/toktx/win";
		public const string TokTxOsxUrl = "https://fwd.needle.tools/needle-engine/toktx/osx";
		public const string TokTxOsxSiliconUrl = "https://fwd.needle.tools/needle-engine/toktx/osx-silicon";
		
		internal static Task<string> DownloadToktx()
		{
			var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
			var isArm = RuntimeInformation.ProcessArchitecture == Architecture.Arm64;
			var url = isWindows ? TokTxWinUrl : isArm ? TokTxOsxSiliconUrl : TokTxOsxUrl;
			return DownloadHelper.Download(url, "toktx");
		}

		
		internal static void SetToktxCommandPathVariable(ref string cmd)
		{
#if UNITY_EDITOR_WIN
			var toktxPath = GetToktxDefaultInstallationLocation();
			cmd = $"\"set PATH=%PATH%;{toktxPath}\" && {cmd}";
#endif
		}

		internal static string GetToktxDefaultInstallationLocation()
		{
#if UNITY_EDITOR_WIN
			var defaultInstallationLocation = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
			return defaultInstallationLocation + "\\KTX-Software\\bin";
#else
			return null;
#endif
		}

		// https://stackoverflow.com/questions/19705401/how-to-set-system-environment-variable-in-c/19705691#19705691
// 		[MenuItem("Test/TryAddToktx path")]
// 		public static void TryAddToktxPath()
// 		{
// #if UNITY_EDITOR_WIN
// 			var PATH = "PATH";
// 			var scope = EnvironmentVariableTarget.Machine;
// 			var val = Environment.GetEnvironmentVariable(PATH, scope);
//
// 			// ProcessHelper.RunCommand(@"set PATH=%PATH%;C:\your\path\here\")
//
// 			// Environment.SetEnvironmentVariable(PATH, val, scope);
// #endif
// 		}
	}
}