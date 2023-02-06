using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.Interfaces;

namespace Needle.Engine.ProjectBundle
{
	[UsedImplicitly]
	public class BundleScriptDirectoryProvider : ITypesProvider
	{
		// private readonly HashSet<string> temp_registered = new HashSet<string>();

		// public void Setup(ComponentGenerator generator, IProjectInfo proj)
		// {
		// 	var map = new Dictionary<string, List<ImportInfo>>();
		// 	var projectDirectory = proj.ProjectDirectory;
		// 	foreach (var bundle in BundleRegistry.Instance.Bundles)
		// 	{
		// 		var target = bundle.FindScriptGenDirectory();
		// 		if (!map.ContainsKey(target))
		// 			map.Add(target, new List<ImportInfo>());
		// 		bundle.FindImports(map[target], projectDirectory);
		// 	}
		// 	temp_registered.Clear();
		// 	foreach (var entry in map)
		// 	{
		// 		foreach (var script in entry.Value)
		// 		{
		// 			var dir = Path.GetDirectoryName(script.FilePath);
		// 			if (temp_registered.Contains(dir)) continue;
		// 			temp_registered.Add(dir);
		// 			generator.RegisterDirectory(dir, entry.Key, false);
		// 		}
		// 	}
		// }

		public void AddImports(List<ImportInfo> imports, IProjectInfo proj)
		{
			var projectDirectory = proj.ProjectDirectory;
			foreach (var bundle in BundleRegistry.Instance.Bundles)
			{
				bundle.FindImports(imports, projectDirectory);
			}
		}
	}
}