using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	internal static class TypescriptDragDrop
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			var list = new List<Object>();
			EditorApplication.update += () =>
			{
				list.Clear();
				var found = false;
				for (var i = 0; i < DragAndDrop.objectReferences.Length; i++)
				{
					var obj = DragAndDrop.objectReferences[i];
					if (obj is Typescript ts)
					{
						found = true;
						ts.FindComponent(list);
					}
					else list.Add(obj);

					if (found)
						DragAndDrop.objectReferences = list.Cast<Object>().ToArray();
				}
			};
		}
	}
}