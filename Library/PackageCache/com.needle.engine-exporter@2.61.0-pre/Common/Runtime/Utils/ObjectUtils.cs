using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine.Utils
{
	public static class ObjectUtils
	{
		public static T GetComponentInParent<T>(GameObject go)
		{
			if (!go) return default;
			if (go.TryGetComponent<T>(out var t))
			{
				return t;
			}
			var parent = go.transform?.parent;
			if (parent) return GetComponentInParent<T>(parent.gameObject);
			return default;
		}

		public static void FindObjectsOfType<T>(List<T> results) where T : class
		{
			var gos = SceneManager.GetActiveScene().GetRootGameObjects();
			foreach (var go in gos) Traverse(go);

			void Traverse(GameObject go)
			{
				if (go.gameObject.TryGetComponent<T>(out var res))
				{
					results.Add(res);
				}
				var t = go.transform;
				for (var i = 0; i < t.childCount; i++)
				{
					var ch = t.GetChild(i);
					Traverse(ch.gameObject);
				}
			}
		}

		public static T FindObjectOfType<T>() where T : class
		{
			var gos = SceneManager.GetActiveScene().GetRootGameObjects();
			foreach (var go in gos)
			{
				var res = Traverse(go);
				if (res != null) return res;
			}

			T Traverse(GameObject go)
			{
				if (go.gameObject.TryGetComponent<T>(out var res))
					return res;
				var t = go.transform;
				for (var i = 0; i < t.childCount; i++)
				{
					var ch = t.GetChild(i);
					res = Traverse(ch.gameObject);
					if (res != null) return res;
				}
				return default;
			}

			return default;
		}

		public static void SafeDestroy(this Object obj)
		{
			if (!obj) return;
			if (!Application.isPlaying) Object.DestroyImmediate(obj);
			else Object.Destroy(obj);
		}

		public static string GetId(this Object obj)
		{
			if (obj == null) return null;
			var original = obj;
			// always use guid from transform
			// threejs knows no difference between gameobject and transform
			// this is merely to avoid having multiple guids pointing to the same object
			if (obj is GameObject go) obj = go.transform;

#if UNITY_EDITOR
			var identifier = GlobalObjectId.GetGlobalObjectIdSlow(obj);
			var id = identifier.targetObjectId.ToString();
			// id can be zero with hideflags set to e.g. DontSaveInEditor
			if (id == "0")
			{
				switch (obj)
				{
					default:
						id = obj.GetInstanceID().ToString();
						break;
					case Texture tex:
						return tex.imageContentsHash.ToString();
				}
			}
			if (obj)
			{
				if (EditorUtility.IsPersistent(obj))
					id += "_" + identifier.assetGUID;
				if (PrefabUtility.IsPartOfAnyPrefab(obj))
					id += "_" + identifier.targetPrefabId;
			}

			// fallback to random id
			if (id == "0")
			{
				id = "r_" + Mathf.FloorToInt(Random.Range(1_000_000, 9_999_999)).ToString();
			}
			// HACK: since we serialize rect transforms since 71699dff7b948bb1931517720135cf1fb6659381 to allow putting UI in gltf files we need to differentiate between transforms and rect transform components.
			if (original is RectTransform) id += "_1";
			return id;
#else
			return obj.GetInstanceID().ToString();
#endif
		}

		public static string GetIdShort(this Object obj)
		{
#if UNITY_EDITOR
			var identifier = GlobalObjectId.GetGlobalObjectIdSlow(obj);
			var id = identifier.targetObjectId.ToString();
			return id;
#else
			return obj.GetInstanceID().ToString();
#endif
		}
	}
}