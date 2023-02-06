using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Utils
{
	public static class WorkspaceUtils
	{
		public static void OpenWorkspace(string directory)
		{
			directory = Path.GetFullPath(directory);
			
			if (TryGetWorkspace(directory, out var workspacePath))
			{
				var packageJson = directory + "/package.json";
				if(File.Exists(directory))
					AddLocalPackages(packageJson, workspacePath);
				#if UNITY_EDITOR
				UnityEditor.EditorUtility.OpenWithDefaultApp(workspacePath);
				#endif
			}
			else
			{
				OpenWithCode();
				async void OpenWithCode()
				{
					await ProcessHelper.RunCommand("code \"" + directory + "\"", null);
				}
			}
		}
		
		public static bool TryGetWorkspace(string directory, out string workspacePath)
		{
			if (string.IsNullOrWhiteSpace(directory))
			{
				workspacePath = null;
				return false;
			}
			directory = directory.TrimEnd('\\').TrimEnd('/');
			directory = Path.GetFullPath(directory);
			workspacePath = Directory.GetFiles(directory, "*.code-workspace", SearchOption.TopDirectoryOnly).FirstOrDefault();
			var success = !string.IsNullOrEmpty(workspacePath);
			return success;
		}

		public static void AddLocalPackages(string packageJson, string workspacePath)
		{
			if (!PackageUtils.TryReadDependencies(packageJson, out var deps)) return;

			if (TryReadWorkspace(workspacePath, out var workspaceContent))
			{
				var changed = false;
				foreach (var dep in deps)
				{
					if (dep.Value.EndsWith("~") || dep.Value.StartsWith("file:"))
					{
						if (AddToFolders(workspaceContent, dep.Key))
							changed = true;
					}
				}
				if (changed)
				{
					WriteWorkspace(workspaceContent, workspacePath);
				}
			}
		}

		private static bool TryEnsureWorkspace(ref string workspacePathOrDirectory)
		{
			if (!workspacePathOrDirectory.EndsWith(".code-workspace"))
			{
				var attr = File.GetAttributes(workspacePathOrDirectory);
				var dir = workspacePathOrDirectory;
				if (attr.HasFlag(FileAttributes.Directory) == false)
				{
					dir = Path.GetDirectoryName(workspacePathOrDirectory);
				}
				if (dir != null)
				{
					workspacePathOrDirectory = Directory.GetFiles(dir, "*.code-workspace", SearchOption.TopDirectoryOnly).FirstOrDefault();
				}
			}
			return workspacePathOrDirectory != null && File.Exists(workspacePathOrDirectory);
		}

		public static bool TryReadWorkspace(string workspacePath, out JObject obj)
		{
			obj = null;
			if (!TryEnsureWorkspace(ref workspacePath)) return false;
			var text = File.ReadAllText(workspacePath);
			obj = JsonConvert.DeserializeObject<JObject>(text);
			return obj != null;
		}

		public static void WriteWorkspace(JObject workspace, string workspacePath)
		{
			if (!TryEnsureWorkspace(ref workspacePath)) return;
			var result = JsonConvert.SerializeObject(workspace, Formatting.Indented);
			File.WriteAllText(workspacePath, result);
		}

		/// <returns>True if was added, false if already in array</returns>
		public static bool AddToFolders(JObject workspace, string name, string path = null)
		{
			var foldersArray = (JArray)workspace["folders"] ?? new JArray();
			foreach (var jToken in foldersArray)
			{
				var entry = (JObject)jToken;
				if (entry["name"]?.Value<string>() == name)
					return false;
			}
			var dependency = new JObject();
			dependency["name"] = name;
			dependency["path"] = path ?? "node_modules/" + name;
			foldersArray.Add(dependency);
			workspace["folders"] = foldersArray;
			return true;
		}

		public static bool RemoveFromFolders(JObject workspace, string name)
		{
			var folders = (JArray)workspace["folders"];
			if (folders == null) return false;
			var changed = false;
			for (var index = folders.Count - 1; index >= 0; index--)
			{
				var jToken = folders[index];
				var entry = (JObject)jToken;
				if (entry["name"]?.Value<string>() == name)
				{
					folders.RemoveAt(index);
					changed = true;
				}
			}
			return changed;
		}
	}
}