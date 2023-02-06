using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Core
{
	public class AssetDependencyHandler
	{
		private readonly string cacheDirectory;
		private readonly Dictionary<Object, AssetDependency> _assetDependencies = new Dictionary<Object, AssetDependency>();

		public AssetDependencyHandler()
		{
			cacheDirectory = ProjectInfoExtensions.GetCacheDirectory();
		}

		internal bool TryGetDependency(Object obj, out AssetDependency dep)
		{
			var path = AssetDatabase.GetAssetPath(obj);
			if (string.IsNullOrEmpty(path))
			{
				dep = null;
				return false;
			}

			if (_assetDependencies.TryGetValue(obj, out dep))
				return dep != null;
			
			dep = AssetDependency.Get(path, cacheDirectory);
			_assetDependencies.Add(obj, dep);
			return dep != null;
		}

		public void WriteCache()
		{
			foreach(var dep in _assetDependencies.Values)
				dep?.WriteToCacheAll();
		}
	}
}