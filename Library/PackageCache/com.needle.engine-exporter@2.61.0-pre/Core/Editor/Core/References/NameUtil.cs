

#nullable enable

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine.Core.References
{
	internal class RenameUtil : IDisposable
	{
		private readonly Dictionary<string, int> namesFound = new Dictionary<string, int>();
		private readonly List<(GameObject go, string originalName)> renamed = new List<(GameObject go, string originalName)>();
		private readonly List<GameObject> firstFound = new List<GameObject>();

		public RenameUtil(ExportContext? context, GameObject root)
		{
			var reference = context?.References;
			if (reference != null)
			{
				FindDuplicateName(reference, root);
				WalkHierarchyRecursive(reference, root);
				// foreach (var first in firstFound)
				// {
				// 	Rename(reference, first, 0);
				// }
			}
		}

		private void WalkHierarchyRecursive(IReferenceRegistry reference, GameObject go)
		{
			// level by level
			foreach (var obj in go.transform)
			{
				var child = obj as Transform;
				if (!child || child == null) continue;
				FindDuplicateName(reference, child.gameObject);
			}
			foreach (var obj in go.transform)
			{
				var child = obj as Transform;
				if (!child || child == null) continue;
				WalkHierarchyRecursive(reference!, child.gameObject);
			}
		}

		private void FindDuplicateName(IReferenceRegistry reference, GameObject go)
		{
			if (reference is ReferenceRegistry reg)
			{
				if (!go) return;
				var name = go.name;
				if (namesFound.ContainsKey(name))
				{
					Rename(reg, go, namesFound[name]);
					namesFound[name] += 1;
				}
				else
				{
					namesFound[name] = 1;
					firstFound.Add(go);
				}
			}
		}

		private void Rename(ReferenceRegistry reference, GameObject go, int number)
		{
			var name = go.name;
			renamed.Add((go, name));
			// it is not clear to me how gltf names are generated. when exporting a hierarchy obj/obj/obj it sometimes generated obj/obj_2/obj_4 or obj/obj_2/obj_3. Using the id we can hopefully ensure the name is unique within a certain glb. This also only happens if any name duplicates are found so to avoid that users can simple create unique names themselves. The name should not be relevant for them anyways tho.
			var exportName = go.name + "_" + number;
			// BEWARE: we must not actually rename objects because that will break animations...
			// go.name = exportName;
			// Debug.Log("Register " + go.name + " as " + exportName,go);
			reference?.RegisterRemap(go, exportName);
		}

		public void Dispose()
		{
			foreach (var r in renamed)
			{
				r.go.name = r.originalName;
			}
			renamed.Clear();
		}
	}
}