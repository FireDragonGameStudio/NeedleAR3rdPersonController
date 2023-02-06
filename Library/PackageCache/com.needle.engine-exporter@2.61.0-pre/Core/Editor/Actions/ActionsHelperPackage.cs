using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal static class ActionsHelperPackage
	{
		[MenuItem(Constants.MenuItemRoot + "/Internal/Update @types-three")]
		private static async void UpdateThreeTypesMenuItem()
		{
			var project = Object.FindObjectOfType<ExportInfo>();
			if (!project || !project.Exists()) return;
			await UpdateThreeTypes(project.GetProjectDirectory());
		}
		
		internal static Task UpdateThreeTypes(string directory)
		{
			var packagePath = Path.GetFullPath(directory) + "/node_modules/@needle-tools/engine/node_modules/@needle-tools/helper";
			if (!Directory.Exists(packagePath))
				return Task.CompletedTask;
			var cmd = "npm run tool:update-types-three \"" + directory + "\"";
			return ProcessHelper.RunCommand(cmd, packagePath);
		}
	}
}