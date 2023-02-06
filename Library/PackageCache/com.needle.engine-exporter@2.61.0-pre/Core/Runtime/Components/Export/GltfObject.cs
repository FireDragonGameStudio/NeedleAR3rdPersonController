#if GLTFAST
#endif
using System;
using System.IO;
using Needle.Engine.Gltf;
using Needle.Engine.Utils;
using Unity.Profiling;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Components
{
	[ExecuteInEditMode, DisallowMultipleComponent]
	[HelpURL(Constants.DocumentationUrl)]
	public class GltfObject : MonoBehaviour, IExportableObject
	{
		// TODO: we only have this because ExportInfo editor shows option to add gltf object if none is found
#if UNITY_EDITOR
		[InitializeOnLoadMethod]
		private static void Init()
		{
			SceneActions.RegisterCreateGltfObjectAction(() =>
			{
				var go = new GameObject();
				go.name = "My Scene";
				go.AddComponent<GltfObject>();
				Selection.activeObject = go;
			});
		}
#endif

		[Tooltip("When enabled this part of your hierarchy will not be exported again")]
		public bool SuppressExport = false;

		// [field: SerializeField,Tooltip("Exports Unity components settings as part of a glTF extension. This is the recommended setting. Note that certain components only work if this is enabled (e.g. Timeline/PlayableDirector)")]
		// public bool ComponentsInExtension { get; set; } = true;

		[Header("Experimental")]
		public bool EmbedSkybox = true;

		private IGltfExportHandler exportHandler;

		private static ProfilerMarker marker = new ProfilerMarker(nameof(GltfObject) + "." + nameof(Export));

		public virtual bool Export(string path, bool force, IExportContext context)
		{
#if UNITY_EDITOR
			if (SuppressExport)
			{
				Debug.Log("<color=#999999>Export disabled: " + name + "</color>", this);
				return false;
			}
			var binary = path.EndsWith(".glb");
			var json = path.EndsWith(".gltf");
			if (!binary && !json) throw new Exception("Invalid path, expected extension: .gltf or .glb");
			try
			{
				if (CopyInsteadOfExport(out var filePath))
				{
					// make sure we're not copying a .gltf into a .glb 
					if (Path.GetExtension(filePath) != Path.GetExtension(path))
						path = Path.ChangeExtension(path, Path.GetExtension(filePath));
					
					Debug.Log("<b>Copy</b> " + filePath + " <b>to</b> " + path);
					
					CheckForPrefabOverrideIssues(out var rootTransformError, out var overrideError);
					if (rootTransformError != null)
						Debug.LogError("<b>Error with " + name + ":</b> " + rootTransformError, this);
					if (overrideError != null)
						Debug.LogError("<b>Error with " + name + ":</b> " + overrideError, this);
					
					File.Copy(filePath, path, true);
					
					// get dependencies
					// TODO will only work for same-directory dependencies right now
					// TODO will overwrite files that have the same name
					var dependencies = AssetDatabase.GetDependencies(filePath);
					foreach (var dep in dependencies)
					{
						if (!dep.EndsWith(".png") && !dep.EndsWith(".jpeg") && !dep.EndsWith(".jpg") && !dep.EndsWith(".exr")) continue;
						File.Copy(dep, Path.Combine(Path.GetDirectoryName(path)!, Path.GetFileName(dep)), true);
					}
					
					return true;
				}
				
				using (marker.Auto())
				{
					exportHandler ??= GltfExportHandlerFactory.CreateHandler();
					var prevExportSkybox = context.Settings.ExportSkybox;
					try
					{
						context.Settings.ExportSkybox &= EmbedSkybox;
						exportHandler.OnExport(this.transform, path, context);
					}
					finally
					{
						context.Settings.ExportSkybox = prevExportSkybox;
					}
				}
			}
			catch (AbortExportException)
			{
				throw;
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}
			return true;
#else
			Debug.LogWarning("Runtime export is not supported");
			return false;
#endif
		}

		public bool CopyInsteadOfExport(out string filePath)
		{
			return AssetUtils.IsGlbAsset(gameObject, out filePath);
		}
		
#if UNITY_EDITOR
		internal void CheckForPrefabOverrideIssues(out string rootTransformError, out string overrideError)
		{
			rootTransformError = null;
			overrideError = null;
			
			var go = this.gameObject;
			var asset = PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(go);
			var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(asset);
			if (prefab.transform.localPosition != Vector3.zero || prefab.transform.localRotation != Quaternion.identity || prefab.transform.localScale != Vector3.one)
			{
				rootTransformError = "This referenced glTF has root transforms applied in Unity. Make sure to uncheck \"Remove Empty Roots\" to get the same results in Unity and the web.";
			}
				
			// display a list of overrides - these are not allowed
			var addedComponents = PrefabUtility.GetAddedComponents(go);
			var addedObjects = PrefabUtility.GetAddedGameObjects(go);
			var propertyModifications = PrefabUtility.GetPropertyModifications(go);

			var hasAnyNonDefaultOverrides = false;

			foreach (var mod in propertyModifications)
			{
				if (PrefabUtility.IsDefaultOverride(mod)) continue;
				if (mod.target == prefab.transform && mod.propertyPath.StartsWith("m_Local")) continue; // skip scale
				if (mod.propertyPath == "m_DirtyAABB") continue; // skip SkinnedMeshRenderer bounds
				if (mod.propertyPath.StartsWith("m_AABB.")) continue; // skip SkinnedMeshRenderer bounds
				
				// Debug.Log(mod.propertyPath + ", " + mod.target);
				hasAnyNonDefaultOverrides = true;
				break;
			}
				
			if (hasAnyNonDefaultOverrides || addedComponents.Count > 1 || addedObjects.Count > 0)
			{
				overrideError = "This referenced glTF has overrides. These overrides will not be visible on the web as the glTF file is directly copied out. Only root transform changes will be applied.";
			}
		}
#endif

		// private bool OnExportAdditionalTextures(Material material, string prop)
		// {
		// 	return ExportAdditionalTextures?.Invoke(material, prop) ?? false;
		// }


// #if UNITY_EDITOR && GLTFAST
// 		private static void ExportWithGltfFast(IExportableObject root, GameObject gameObject, string path, bool binary)
// 		{
// 			var settings = new ExportSettings
// 			{
// 				format = binary ? GltfFormat.Binary : GltfFormat.Json
// 			};
//
// 			var export = new GameObjectExport(settings);
// 			export.AddScene(new[] { gameObject }, root.name);
// 			AsyncHelpers.RunSync(() => export.SaveToFileAndDispose(path));
// 		}
// #endif
	}
}