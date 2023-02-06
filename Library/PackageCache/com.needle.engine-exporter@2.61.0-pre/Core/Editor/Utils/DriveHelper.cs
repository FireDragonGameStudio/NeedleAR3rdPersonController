using System.IO;

namespace Needle.Engine.Utils
{
	internal static class DriveHelper
	{
		public static bool IsFat32Drive(string path)
		{
			var drives = DriveInfo.GetDrives();
			foreach (var drive in drives)
			{
				if (path.StartsWith(drive.Name))
				{
					return drive.DriveFormat == "FAT32";
				}
			}
			return false;
		}
		
		public static bool HasEnoughAvailableDiscSpace(string path, float minSpaceInMb)
		{
			var allDrives = DriveInfo.GetDrives();
			var info = new DirectoryInfo(path);
			var root = info.Root;
			foreach (var drive in allDrives)
			{
				if (drive.RootDirectory.FullName != root.FullName) continue;
				var availableMb = drive.AvailableFreeSpace / (1024 * 1024);
				if (availableMb >= minSpaceInMb)
				{
					return true;
				}
			}
			return false;
		}
	}
}