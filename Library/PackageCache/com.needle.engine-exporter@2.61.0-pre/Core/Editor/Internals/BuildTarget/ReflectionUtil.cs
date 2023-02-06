using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	internal static class InstanceCreatorUtil
	{
		public static List<T> CreateCollectionSortedByPriority<T>()
		{
			var types = TypeCache.GetTypesDerivedFrom<T>()
				.Where(e => !e.IsAbstract && !e.IsInterface);
			var res = new List<T>();
			foreach (var type in types)
			{
				if (typeof(Component).IsAssignableFrom(type))
					continue;
				res.Add((T)Activator.CreateInstance(type));
			}
			return res;
		}
	}
}