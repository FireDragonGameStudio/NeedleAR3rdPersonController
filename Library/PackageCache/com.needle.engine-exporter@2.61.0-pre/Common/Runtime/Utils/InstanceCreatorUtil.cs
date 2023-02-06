using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class InstanceCreatorUtil
	{
		public static List<T> CreateCollectionSortedByPriority<T>()
		{
			var res = new List<T>();
#if UNITY_EDITOR
			var types = TypeCache.GetTypesDerivedFrom<T>()
				.OrderByDescending(e => e.GetCustomAttribute<Priority>()?.Value ?? 0)
				.Where(e => !e.IsAbstract && !e.IsInterface);
			foreach (var type in types)
			{
				if (typeof(Component).IsAssignableFrom(type))
					continue;
				res.Add((T)Activator.CreateInstance(type));
			}
#endif
			return res;
		}
	}
}