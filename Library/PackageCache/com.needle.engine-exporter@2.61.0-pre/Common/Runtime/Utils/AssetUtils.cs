using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class AssetUtils
	{
		public static bool IsGlbAsset(GameObject go, out string path)
		{
#if UNITY_EDITOR
			path = PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(go);
			if (path.EndsWith(".glb") || path.EndsWith(".gltf"))
			{
				return PrefabUtility.GetNearestPrefabInstanceRoot(go) == go;
			}
			return false;
#else
			path = null;
			return false;
#endif
		}
	}
}