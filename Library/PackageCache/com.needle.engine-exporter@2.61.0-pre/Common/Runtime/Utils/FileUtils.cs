using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Utils
{
	public static class FileUtils
	{
		public static Task<bool> DeleteDirectoryRecursive(string dir)
		{
			if (!Directory.Exists(dir))
			{
				Debug.LogError("Directory does not exist: " + dir);
				return Task.FromResult(false);
			}
			var dirInfo = new DirectoryInfo(dir);
			var name = dirInfo.Name;
			dir = dirInfo.Parent!.FullName;
			
#if UNITY_EDITOR_WIN
			// /Q is quiet mode, /s is subdirectories/files
			return ProcessHelper.RunCommand("rmdir /s /Q \"" + name + "\"", dir);
#else
			return ProcessHelper.RunCommand("rm -rf " + name, dir);
#endif
		}
		
		// [MenuItem("Test/Symlink")]
		// private static void TestSymlink()
		// {
		// 	CreateSymlink("F:/git/needle-tiny-playground/projects/Unity-Threejs_2020_3_light/Assets/Scenes/NewInput/test.txt", "F:/git/needle-tiny-playground/projects/Unity-Threejs_2020_3_light/Assets/test.txt");
		// }
		
		/// <summary>
		/// Experimental, needs admin
		/// </summary>
		internal static void CreateSymlink(string realFilePath, string targetFilePath)
		{
			
			// documentation https://ss64.com/nt/mklink.html
			var cmd = $"npm run create:symlink \"{realFilePath}\" \"{targetFilePath}\" & timeout 10";
			var dir = Path.GetFullPath(Constants.RuntimeNpmPackagePath);
			Debug.Log(cmd + "\n" + dir);
			var psi = ProcessHelper.CreateCommandProcessInfo(cmd, dir);
			Process.Start(psi);
		}
		
		internal static void CopyRecursively(
			DirectoryInfo source,
			DirectoryInfo target,
			Predicate<FileInfo> fileFilter = null,
			Predicate<DirectoryInfo> dirFilter = null
		)
		{
			if (!source.Exists) return;

			var directoryExists = target.Exists;

			foreach (var fi in source.GetFiles())
			{
				if (fileFilter != null && !fileFilter(fi)) continue;
				if (!directoryExists)
				{
					directoryExists = true;
					Directory.CreateDirectory(target.FullName);
				}
				if (fi.Exists)
				{
					var targetPath = target.FullName + "/" + fi.Name;
#if UNITY_EDITOR_WIN
					if (targetPath.Length > 260)
					{
						Debug.LogError("Can not copy file to path because it is too long: " + targetPath);
						continue;
					}
#endif
					fi.CopyTo(targetPath, true);
				}
			}

			foreach (var diSourceSubDir in source.GetDirectories())
			{
				if (dirFilter != null && !dirFilter(diSourceSubDir)) continue;
				var nextTargetSubDir = new DirectoryInfo(Path.Combine(target.FullName, diSourceSubDir.Name));
				CopyRecursively(diSourceSubDir, nextTargetSubDir, fileFilter, dirFilter);
			}
		}

		public struct FileStats
		{
			public string Extension;
			public long SizeInBytes;
		}

		public static string CalculateFileStats(DirectoryInfo directoryInfo)
		{
			if (!directoryInfo.Exists) return null;
			var str = new StringBuilder();
			var fileInfos = CollectFileInfo(directoryInfo);
			TotalByExtension(fileInfos, str);
			str.AppendLine("----");
			TotalByOutputSubDirectory(directoryInfo, fileInfos, str);
			return str.ToString();
		}

		public static long GetTotalSize(DirectoryInfo directory)
		{
			var infos = CollectFileInfo(directory);
			return infos.Sum(info => info.Length);
		}

		public static List<FileInfo> CollectFileInfo(DirectoryInfo directoryInfo, List<FileInfo> stats = null)
		{
			if (stats == null) stats = new List<FileInfo>();
			if (!directoryInfo.Exists) return stats;
			foreach (var file in directoryInfo.EnumerateFiles())
			{
				stats.Add(file);
			}
			foreach (var dir in directoryInfo.EnumerateDirectories())
			{
				CollectFileInfo(dir, stats);
			}
			return stats;
		}

		private static void TotalByOutputSubDirectory(DirectoryInfo dir, List<FileInfo> fileInfos, StringBuilder str)
		{
			var subDirectories = dir.GetDirectories();
			var byDirectories = fileInfos
				.GroupBy(x => FindSubDirectory(x).Name)
				.ToDictionary(f => f.Key, x => x.ToList());

			str.AppendLine("By Directory:");
			AppendStatistics(byDirectories, str);

			DirectoryInfo FindSubDirectory(FileInfo file)
			{
				var cur = file.Directory;
				while (cur.FullName != dir.FullName && !subDirectories.Any(d => d.FullName == cur.FullName) && cur!.Parent != null)
					cur = cur.Parent;
				return cur;
			}
		}

		private static void TotalByExtension(List<FileInfo> fileInfos, StringBuilder str)
		{
			var byExtension = fileInfos
				.GroupBy(x => x.Extension)
				.ToDictionary(f => f.Key, x => x.ToList());
			str.AppendLine("By Type:");
			var totalMb = AppendStatistics(byExtension, str);
			str.Append("•\t<b>Total = ").Append(totalMb.ToString("0.0")).AppendLine(" mb</b>");
		}

		private static float AppendStatistics(Dictionary<string, List<FileInfo>> infos, StringBuilder str)
		{
			float totalMb = 0;
			foreach (var kvp in infos)
			{
				str.Append("•\t");
				str.Append(kvp.Key).Append(" → ");
				var sum = 0L;
				var files = kvp.Value;
				foreach (var file in files)
				{
					sum += file.Length;
				}
				var sizeInMb = sum / (1024 * 1024f);
				totalMb += sizeInMb;
				str.Append(" x ").Append(files.Count).Append(" = ").Append(sizeInMb.ToString("0.0")).AppendLine(" mb");
			}
			return totalMb;
		}
	}
}