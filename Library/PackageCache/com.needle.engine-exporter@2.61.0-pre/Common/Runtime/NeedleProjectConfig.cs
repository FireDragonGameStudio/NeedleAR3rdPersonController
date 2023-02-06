using System;
using System.IO;
using Newtonsoft.Json;
using UnityEngine;

namespace Needle.Engine
{
	/// <summary>
	/// Can be put into a web project directory as needle.config.json to configure export targets
	/// </summary>
	[Serializable]
	public class NeedleProjectConfig
	{
		public const string NAME = "needle.config.json";

		public string buildDirectory = "dist";
		public string assetsDirectory = "assets";
		public string scriptsDirectory = "src/scripts";
		public string codegenDirectory = "src/generated";
		
		
		public static bool TryLoad(string projectDirectory, out NeedleProjectConfig config)
		{
			var path = Path.Combine(projectDirectory, NAME);
			if (File.Exists(path))
			{
				var json = File.ReadAllText(path);
				if (!string.IsNullOrWhiteSpace(json))
				{
					config = JsonConvert.DeserializeObject<NeedleProjectConfig>(json);
					return true;
				}
			}
			config = default;
			return false;
		}

		public static bool TryCreate(IProjectInfo project, out NeedleProjectConfig config, out string path)
		{
			var dir = project.ProjectDirectory;
			if (Directory.Exists(dir) && File.Exists(dir + "/package.json"))
			{
				config = new NeedleProjectConfig();

				if (!Directory.Exists(project.AssetsDirectory))
				{
					if (Directory.Exists(dir + "/public"))
						config.assetsDirectory = "public";
				}

				path = Path.Combine(dir, NAME);
				var content = JsonConvert.SerializeObject(config, Formatting.Indented);
				File.WriteAllText(path, content);
				return true;
			}

			path = null;
			config = null;
			return false;
		}
		
	}
}