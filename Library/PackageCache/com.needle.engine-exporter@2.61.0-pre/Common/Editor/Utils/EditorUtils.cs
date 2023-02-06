using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class EditorUtils
	{
		public static bool IsEditorOnly(Object obj, Transform searchUntil = null)
		{
			while (true)
			{
				if (!obj) return false;
				if (obj is Component comp) obj = comp.gameObject;
				var go = obj as GameObject;
				if (!go) return false;
				// when explicitly exporting a gltf from menu item and SOME parent (or the root) in the hierarchy is editor only
				// we only search until the specified object (the root) and consider the sub hierarchy only 
				if (searchUntil && go.transform == searchUntil) return false;
				if (go.CompareTag("EditorOnly")) return true;
				obj = go.transform.parent;
			}
		}

		public static bool TryGetCameObject(Object obj, out GameObject go)
		{
			go = obj as GameObject;
			if (!go && obj is Component comp) go = comp.gameObject;
			return go;
		}

		internal static bool IsCrossSceneReference(Object obj1, Object obj2)
		{
			if (EditorUtility.IsPersistent(obj2))
			{
				if (TryGetCameObject(obj1, out var go1) && TryGetCameObject(obj2, out var go2))
				{
					if (go1.scene.IsValid())
						return go1.scene.path == go2.scene.path;
				}
			}
			return false;
		}
	}
}