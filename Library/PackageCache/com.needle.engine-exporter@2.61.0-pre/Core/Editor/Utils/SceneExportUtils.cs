using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Core;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;

namespace Needle.Engine.Utils
{
	public static class SceneExportUtils
	{
		public static bool IsValidExportScene(out string directory, out ExportInfo info)
		{
			directory = null;
			info = Object.FindObjectOfType<ExportInfo>();
			if (!info) return false;
			if (!info.IsValidDirectory()) return false;
			directory = Path.GetFullPath(Builder.BasePath + "/" + info.DirectoryName);
			return Directory.Exists(directory);
		}

		public static bool TryGetGameObject(Object obj, out GameObject go)
		{
			go = obj as GameObject;
			if (go)
			{
				return true;
			}

			go = (obj as Component)?.gameObject;
			if (go)
			{
				return true;
			}
			
			return false;
		}

		public static bool TryGetInstanceForExport(Object obj, out GameObject root, out Action dispose)
		{
			root = null;
			dispose = null;

			if (TryCreateInstance(obj, out root, out dispose))
				return true;


			if (TryGetGameObject(obj, out root)) 
				return true;

			return false;
		}

		public static bool TryCreateInstance(Object obj, out GameObject root, out Action dispose)
		{
			if (obj is SceneAsset scene)
			{
				var scenePath = AssetDatabase.GetAssetPath(scene);

				var active = SceneManager.GetActiveScene();
				var exportingActiveScene = active.path == scenePath;

				Scene sceneToExport;
				ParentScope parents = default;
				LightScope lights = default;
				GameObject tempObject = default;
				if (exportingActiveScene)
				{
					sceneToExport = active;
				}
				else
				{
					lights = new LightScope(Object.FindObjectsOfType<Light>());
					sceneToExport = EditorSceneManager.OpenScene(AssetDatabase.GetAssetPath(scene), OpenSceneMode.Additive);
				}

				var roots = sceneToExport.GetRootGameObjects();
				parents = new ParentScope(roots);
				tempObject = new GameObject();
				tempObject.name = scene.name;
				root = tempObject;
				foreach (var sceneObj in roots)
				{
					sceneObj.transform.parent = root.transform;
				}

				dispose = () =>
				{
					if (exportingActiveScene)
						parents.Dispose();

					lights.Dispose();
					tempObject.SafeDestroy();

					if (!exportingActiveScene && sceneToExport.IsValid())
					{
						EditorSceneManager.CloseScene(sceneToExport, true);
					}
				};
				return true;
			}

			if (PrefabUtility.IsPartOfPrefabAsset(obj))
			{
				// Only instantiate prefabs if the reference is a Transform or a GameObject. Otherwise it's a reference to a component on some asset or another custom asset / asset type which we also just want to export normally
				if (obj is GameObject || obj is Transform)
				{
					var asset = obj as GameObject;
					if(obj is Component c_) asset = c_.gameObject;
					var t = asset.transform;
					var isRoot = t.parent == null;
					var shouldInstantiate = false;
					if (isRoot)
					{
						foreach (Transform child in t)
						{
							if (shouldInstantiate) break;
							
							// create instance in scene if it contains a nested gltf
							var nestedExports = child.GetComponentInChildren<IExportableObject>(true);
							if (nestedExports != null)
							{
								shouldInstantiate = true;
							}
						}
					}

					// We dont want to instantiate prefabs every time (currently only if it contains a nested gltf)
					// because we need to modify the hierarchy. 
					if (shouldInstantiate)
					{
						// we do this so we can modify the hierarchy of the prefab at export time
						// currently we basically only need it for nested gltf's (a GltfObject in a prefab / exported glb)
						// because we create a new object and do reparenting which doesnt work when its a prefab asset
						var instance = PrefabUtility.InstantiatePrefab(obj);
						
						if (instance is Component c)
						{
							root = c.gameObject;
						}
						else
						{
							root = instance as GameObject;
						}
						
						
						// If a component in a prefab asset was referenced we get a prefab instance of the whole thing in our scene
						// so we want to destroy the whole instance again
						var objectToDestroy = PrefabUtility.GetOutermostPrefabInstanceRoot(instance);
						if (!objectToDestroy && instance is Component comp) objectToDestroy = comp.gameObject;
						objectToDestroy.hideFlags = HideFlags.HideAndDontSave;
						dispose = () => { Object.DestroyImmediate(objectToDestroy); };
						
						return true;
					}
					
				}
			}

			root = null;
			dispose = null;
			return false;
		}

		private readonly struct ParentScope : IDisposable
		{
			private readonly IList<GameObject> objects;
			private readonly IList<Transform> previousParents;

			public ParentScope(IList<GameObject> objects)
			{
				this.objects = objects;
				previousParents = this.objects.Select(o => o.transform.parent).ToArray();
			}

			public void Dispose()
			{
				if (objects == null) return;
				for (var i = 0; i < objects.Count; i++)
				{
					objects[i].transform.parent = previousParents[i];
				}
			}
		}

		private readonly struct LightScope : IDisposable
		{
			private readonly IList<Light> lightsInScene;
			private readonly IList<bool> prevEnabled;

			public LightScope(IList<Light> lights)
			{
				this.lightsInScene = lights;
				this.prevEnabled = lightsInScene.Select(l => l.enabled).ToArray();
				foreach (var light in lights) light.enabled = false;
			}

			public void Dispose()
			{
				if (lightsInScene == null) return;
				for (var i = 0; i < lightsInScene.Count; i++)
				{
					lightsInScene[i].enabled = prevEnabled[i];
				}
			}
		}
	}
}