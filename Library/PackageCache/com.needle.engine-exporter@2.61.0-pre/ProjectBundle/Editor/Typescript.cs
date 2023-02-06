using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.ProjectBundle
{
	public class Typescript : ScriptableObject
	{
		public string TypeName => name;
		public string Path;

		[HideInInspector] public string NpmDefPath;
		[HideInInspector] public string CodeGenDirectory;

		public void FindComponent(List<Object> comp)
		{
			TryFindComponentInstance(this, comp);
		}

		private static readonly HashSet<Type> knownTypes = new HashSet<Type>();

		private void TryFindComponentInstance(Typescript t, List<Object> list, bool skipDuplicates = true)
		{
			knownTypes.Clear();

			var scriptNameEnd = "/" + t.TypeName + ".cs";
			var componentType = typeof(Component);
			if (!string.IsNullOrEmpty(t.CodeGenDirectory) && Directory.Exists(t.CodeGenDirectory))
			{
				var codeGenDirectory = System.IO.Path.ChangeExtension(t.NpmDefPath, ".codegen");
				var relPath = codeGenDirectory + scriptNameEnd;
				if (File.Exists(relPath))
				{
					var res = AssetDatabase.LoadAssetAtPath<MonoScript>(relPath);
					if (res)
					{
						var type = res.GetClass();

						if (!knownTypes.Contains(type) && componentType.IsAssignableFrom(type))
						{
							knownTypes.Add(type);
							list.Add(res);
						}
					}
				}
			}

			var found = AssetDatabase.FindAssets(t.TypeName);
			foreach (var a in found)
			{
				var path = AssetDatabase.GUIDToAssetPath(a);
				if (path.EndsWith(scriptNameEnd))
				{
					var comp = AssetDatabase.LoadAssetAtPath<MonoScript>(path);
					if (comp)
					{
						var type = comp.GetClass();
						if (!knownTypes.Contains(type) && componentType.IsAssignableFrom(type))
						{
							knownTypes.Add(type);
							list.Add(comp);
						}
					}
				}
			}
		}
	}
}