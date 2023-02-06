using System;
using System.ComponentModel;
using System.IO;
using System.Text.RegularExpressions;

namespace Needle.Engine.Utils
{
	public static class ViteUtils
	{
		public const string ViteConfigName = "vite.config.js";

		/// <param name="projectDirectory"></param>
		/// <param name="enable">Null to not change it</param>
		/// <param name="compressionWasEnabled"></param>
		/// <returns></returns>
		public static bool ChangeGzipCompression(string projectDirectory, bool? enable, out bool compressionWasEnabled)
		{
			compressionWasEnabled = false;
			var foundViteCompression = false;
			var path = projectDirectory + "/" + ViteConfigName;
			if (File.Exists(path))
			{
				var lines = File.ReadAllLines(path);
				var changed = false;
				for (var index = 0; index < lines.Length; index++)
				{
					var line = lines[index];
					var viteCompressionIndex = line.IndexOf("viteCompression(", StringComparison.OrdinalIgnoreCase);
					if (viteCompressionIndex >= 0)
					{
						var isUsingNeedleGZipPlugin = line.IndexOf("needle", StringComparison.OrdinalIgnoreCase) >= 0;
						if (isUsingNeedleGZipPlugin)
						{
							return false;
						}
						foundViteCompression = true;
						var commentIndex = line.IndexOf("//", StringComparison.OrdinalIgnoreCase);
						var isCommentedOut = commentIndex >= 0 && commentIndex < viteCompressionIndex;
						compressionWasEnabled = !isCommentedOut;
						if (enable.HasValue)
						{
							if (!enable.Value && !isCommentedOut)
							{
								changed = true;
								lines[index] = line.Insert(viteCompressionIndex, "//");
							}
							else if (enable.Value && isCommentedOut)
							{
								changed = true;
								lines[index] = line.Remove(commentIndex, 2);
							}
						}
					}
				}
				if (changed)
				{
					File.WriteAllLines(path, lines);
				}
			}
			return foundViteCompression;
		}

		private static readonly Regex PortRegex = new Regex("port: ?(?<port>\\d{3,4})", RegexOptions.Compiled);
		public static bool TryReadPort(string projectDirectory, out int port)
		{
			var path = projectDirectory + "/" + ViteConfigName;
			if (File.Exists(path))
			{
				var text = File.ReadAllText(path);
				var match = PortRegex.Match(text);
				if (match.Success)
				{
					return int.TryParse(match.Groups["port"].Value, out port);
				}
			}

			port = -1;
			return false;
		}
	}
}