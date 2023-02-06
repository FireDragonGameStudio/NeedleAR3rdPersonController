using System.IO;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	// used to export references with guids
	// [CreateAssetMenu(menuName = Constants.MenuItemRoot + "/Internal/Resource Reference (For compiled export)", order = Constants.MenuItemOrder + 0)]
	internal class ResourceReference : ScriptableObject
	{
		public Object[] References;

		public void ExportTo(string outputDirectory)
		{
			if (!Directory.Exists(outputDirectory)) return;
			var targetDir = outputDirectory + "/" + name;
			if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
			foreach (var r in References)
			{
				if (!r) continue;
				var path = AssetDatabase.GetAssetPath(r);
				var attr = File.GetAttributes(path);
				if (attr.HasFlag(FileAttributes.Directory))
				{
					var dirInfo = new DirectoryInfo(path);
					var subDirPath = targetDir + "/" + dirInfo.Name;
					if (!Directory.Exists(subDirPath)) Directory.CreateDirectory(subDirPath);
					CopyAll(new DirectoryInfo(path), new DirectoryInfo(subDirPath));
					CopyMeta(path, subDirPath + ".meta");
				}
				else
				{
					var filePath = targetDir + "/" + Path.GetFileName(path);
					File.Copy(path, filePath, true);
					CopyMeta(path, targetDir);
				}
			}
		}

		private static void CopyMeta(string path, string targetDir)
		{
			var sourceMetaPath = Path.GetDirectoryName(path) + "/" + Path.GetFileNameWithoutExtension(path) + ".meta";
			var targetMetaPath = targetDir.EndsWith(".meta") ? targetDir : (targetDir + "/" + Path.GetFileNameWithoutExtension(path) + ".meta");
			if (File.Exists(sourceMetaPath))
				File.Copy(sourceMetaPath, targetMetaPath, true);
		}

		private static void CopyAll(DirectoryInfo source, DirectoryInfo target)
		{
			if (!Directory.Exists(target.FullName))
				Directory.CreateDirectory(target.FullName);

			foreach (var fi in source.GetFiles())
			{
				fi.CopyTo(Path.Combine(target.FullName, fi.Name), true);
			}

			foreach (var diSourceSubDir in source.GetDirectories())
			{
				var nextTargetSubDir = target.CreateSubdirectory(diSourceSubDir.Name);
				CopyAll(diSourceSubDir, nextTargetSubDir);
			}
		}
	}
}