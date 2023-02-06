using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Core;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Utils
{
	public static class FontsHelper
	{
		public static void ClearCache()
		{
			exportedFontPaths.Clear();
		}

		private static string[] osFontPaths = null;

		private static readonly Dictionary<(Font, string, string), string> exportedFontPaths = new Dictionary<(Font, string, string), string>();
		private static readonly Dictionary<Font, Task> generateTasks = new Dictionary<Font, Task>();

		public static string TryGenerateRuntimeFont(IExportContext context,
			Font font,
			FontStyle style,
			string targetDirectory,
			bool force = false,
			object owner = null)
		{
			var fontPath = AssetDatabase.GetAssetPath(font);
			var isBuiltinFont = fontPath.EndsWith("unity default resources");
			if (isBuiltinFont)
			{
				if (font.name == "LegacyRuntime") font.name = "Arial";
			}

			var chars = GetCharset(font, isBuiltinFont);

			// handle selected font style
			// we need to find the correct font asset for a style
			// e.g. when a Regular font is assigned but as style Bold is selected we want to find the path to the bold font asset
			switch (style)
			{
				case FontStyle.Normal:
					break;
				default:
					if (!isBuiltinFont)
					{
						var styleName = style.ToString();
						var ext = Path.GetExtension(fontPath);
						var newPath = fontPath;
						var expectedPath = "-" + styleName + ext;
						if (!newPath.EndsWith(expectedPath))
						{
							var dashIndex = fontPath.LastIndexOf("-", StringComparison.Ordinal);
							if (dashIndex > 0)
							{
								newPath = fontPath.Substring(0, dashIndex) + "-" + styleName + ext;
							}
							else newPath = newPath.Replace(ext, expectedPath);
							if (File.Exists(newPath))
							{
								font = AssetDatabase.LoadAssetAtPath<Font>(newPath);
								fontPath = newPath;
							}
							else
							{
								Debug.LogWarning($"Could not find font asset for style {styleName} at {newPath}", owner as Object);
							}
						}
					}
					break;
			}

			var charsetDir = Application.dataPath + "/../Library/Needle/Fonts";
			var charsGuid = !string.IsNullOrEmpty(chars) ? GuidGenerator.GetGuid(chars) : "0";
			var charsetPath = $"{charsetDir}/{font.name}-{charsGuid}-charset.txt";
			const string extension = "-msdf.json";

			var key = (font, targetDirectory, chars);
			if (exportedFontPaths.TryGetValue(key, out var path))
			{
				if (generateTasks.TryGetValue(font, out var task))
				{
					if (!task.IsCompleted) return path;
					generateTasks.Remove(font);
				}

				var filePath = path + extension;
				if (force || !File.Exists(filePath))
				{
					exportedFontPaths.Remove(key);
				}
				else
					return path;
			}

			var resultPath = targetDirectory + "/" + font.name.ToLowerInvariant();
			var fullResultPath = resultPath + extension;
			if (!force && File.Exists(fullResultPath) && File.Exists(charsetPath))
				return resultPath;

			if (isBuiltinFont)
			{
				osFontPaths ??= Font.GetPathsToOSFonts();
				if (osFontPaths != null)
				{
					var expectedName = font.name + ".";
					fontPath = osFontPaths.FirstOrDefault(p => p.IndexOf(expectedName, StringComparison.InvariantCultureIgnoreCase) > 0);
				}
			}

			if (fontPath == null || !File.Exists(fontPath))
			{
				Debug.LogWarning("Could not find path to font: " + font.name, font);
				return null;
			}

			var packagePath = context.ProjectDirectory + "/node_modules/" + Constants.RuntimeNpmPackageName;
			if (!Directory.Exists(packagePath))
			{
				packagePath = ProjectInfo.GetNeedleEngineRuntimePackageDirectory();
				if (string.IsNullOrEmpty(packagePath) || !Directory.Exists(packagePath))
				{
					Debug.LogWarning("Can not generate font texture: missing project directory " + packagePath);
					return null;
				}
			}

			// var generateCharset = true;
			if (!string.IsNullOrEmpty(charsetDir) && !string.IsNullOrEmpty(charsetPath))
			{
				Directory.CreateDirectory(charsetDir);
				File.WriteAllText(charsetPath, chars);
			}

			if (font.dynamic && !isBuiltinFont)
			{
				Debug.LogWarning(
					$"Font texture for {font.name} is generated with dynamic set - this may lead to fonts having only the characters currently used in your project. If you want to provide dynamic text support you should change this setting in your font asset",
					font);
			}

			var cmd = "npm run font:generate" +
			          " \"" + Path.GetFullPath(fontPath) + "\"" +
			          " \"" + targetDirectory + "\"" +
			          " \"" + charsetPath + "\""
				;
			Debug.Log($"<b>Generate font files</b> for \"{font.name}\" from {fontPath} at {targetDirectory} using chars at {charsetPath}\ncmd:\n{cmd}");
			RunCommand(font, cmd, packagePath);

			exportedFontPaths.Add(key, resultPath);
			return resultPath;
		}

		// private static readonly Dictionary<Font, string> charset = new Dictionary<Font, string>();
		private static string GetCharset(Font font, bool isBuiltinFont)
		{
			// if (font.name == "Arial" || isBuiltinFont)
			// {
			// 	return null;
			// }
			var set = "";
			var chars = font.characterInfo;
			foreach (var info in chars)
			{
				set += (char)info.index;
				if (set.Length > 5000)
				{
					Debug.LogWarning(
						$"Font {font.name} has more than 5000 characters. This may lead to performance issues. Consider using a smaller font or a font atlas with a custom set of characters. You can configure this in the font asset in Unity.",
						font);
					break;
				}
			}
			// ensure we have the default ascii characters included if e.g. a font asset is used without any chars
			// https://www.w3schools.com/charsets/ref_html_ascii.asp
			if (chars.Length <= 0 || font.dynamic)
			{
				for (var i = 32; i < 127; i++)
				{
					set += (char)i;
				}
			}
			// if encoding fails we get a lot of ? at runtime so make sure the char is in the font texture
			set += "?";
			return set;
		}

		private static async void RunCommand(Font font, string cmd, string dir)
		{
			if (!generateTasks.TryGetValue(font, out var task))
			{
				task = ProcessHelper.RunCommand(cmd, dir);
				generateTasks.Add(font, task);
			}
			await task;
			if (generateTasks.ContainsKey(font))
				generateTasks.Remove(font);
		}
	}
}