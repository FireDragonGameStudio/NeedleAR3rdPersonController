using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using UnityEditor;

namespace Needle.Engine.Utils
{
	public class DownloadHelper
	{
		internal static async Task<string> Download(string url, string name, string extension = null)
		{
			using var client = new HttpClient();
			var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
			if (extension == null) extension = isWindows ? ".exe" : ".pkg";
#if UNITY_EDITOR
			var id = Progress.Start("Download " + name, url, Progress.Options.Indefinite);
#endif
			var arr = await client.GetByteArrayAsync(url);
#if UNITY_EDITOR
			Progress.Finish(id);
#endif
			var home = PathUtils.GetHomePath();
			var targetFolder = home + "/Downloads";
			if (!Directory.Exists(targetFolder)) targetFolder = home;
			var targetPath = targetFolder + "/" + name + extension;
			File.WriteAllBytes(targetPath, arr);
			return targetPath;
		}
	}
}