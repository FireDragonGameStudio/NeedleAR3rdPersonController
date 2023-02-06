using System.Collections.Generic;
using System.Linq;
using UnityEditor;

namespace Needle.Engine.ProjectBundle
{
	public static class TypescriptRegistry
	{
		private static readonly Dictionary<string, List<Typescript>> typesMap = new Dictionary<string, List<Typescript>>();
		private static readonly Dictionary<string, List<Typescript>> typesInNpmDef = new Dictionary<string, List<Typescript>>();

		internal static void MarkDirty(string npmdefPath)
		{
			if (!npmdefPath.EndsWith(Constants.Extension)) return;
			if (typesInNpmDef.TryGetValue(npmdefPath, out var list))
			{
				foreach (var e in list)
				{
					if (typesMap.TryGetValue(e.TypeName, out var types)) 
						types.Remove(e);
				}
				typesInNpmDef.Remove(npmdefPath);
			}
		}

		public static Typescript Find(string typeName)
		{
			if (typesMap.TryGetValue(typeName, out var list))
			{
				return list.FirstOrDefault(e => e);
			}
			
			var typeScriptFiles = AssetDatabase.FindAssets("t:" + nameof(Typescript));
			foreach (var guid in typeScriptFiles)
			{
				var path = AssetDatabase.GUIDToAssetPath(guid);
				if (!path.EndsWith(Constants.Extension)) continue;
				if (typesInNpmDef.ContainsKey(path)) continue;
				
				list = new List<Typescript>();
				typesInNpmDef.Add(path, list);

				var assets = AssetDatabase.LoadAllAssetsAtPath(path);
				foreach (var obj in assets)
				{
					if (obj is Typescript ts)
					{
						list.Add(ts);
						if (!typesMap.TryGetValue(ts.TypeName, out var typesList))
						{
							typesList = new List<Typescript>();
							typesMap.Add(ts.TypeName, typesList);
						}
						typesList.Add(ts);
					}
				}
			}
			if (typesMap.TryGetValue(typeName, out var script))
				return script.FirstOrDefault(s => s);
			return null;
		}
	}
}