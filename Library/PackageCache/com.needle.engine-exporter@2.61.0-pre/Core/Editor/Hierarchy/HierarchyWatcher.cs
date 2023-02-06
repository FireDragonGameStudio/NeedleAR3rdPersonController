using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Hierarchy
{
	internal static class HierarchyWatcher
	{
		internal static event Action<Component> ComponentAdded;
		internal static event Action<Component> ComponentRemoved;
		
		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorApplication.hierarchyChanged += OnHierarchyChanged;
			Run(false);
		}

		private static readonly List<Component> previousComponents = new List<Component>();
		private static readonly List<Component> currentComponents = new List<Component>();

		private static void OnHierarchyChanged()
		{
			Run(true);
		}

		private static void Run(bool detectChange)
		{
			currentComponents.Clear();
			if(Selection.activeObject is GameObject go)
				go.GetComponents(currentComponents); 

			if (detectChange)
			{
				if (ComponentAdded != null)
				{
					foreach (var comp in currentComponents)
					{
						if (previousComponents.Contains(comp)) continue;
						ComponentAdded?.Invoke(comp);
					}
				}
				if (ComponentRemoved != null)
				{
					foreach (var comp in previousComponents)
					{
						if (currentComponents.Contains(comp)) continue;
						ComponentRemoved?.Invoke(comp);
					}
				}
			}
			
			previousComponents.Clear();
			previousComponents.AddRange(currentComponents);
		}
	}
}