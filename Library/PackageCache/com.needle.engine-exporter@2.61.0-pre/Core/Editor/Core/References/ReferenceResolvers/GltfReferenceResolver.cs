using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using JetBrains.Annotations;
using Needle.Engine.Interfaces;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public struct GltfReferenceContext
	{
		public object Owner;
		public object Value;
		public IExportContext Context;
	}

	public interface IReferencedGltfResolver
	{
		bool TryExport(GltfReferenceContext context, out object result);
	}

	[UsedImplicitly]
	public class GltfReferenceResolver : ITypeMemberHandler, IRequireExportContext
	{
		private static readonly List<Object> exported = new List<Object>();
		private static IReferencedGltfResolver[] resolvers = null;

		internal static void ClearCache()
		{
			exported.Clear();
		}

		public GltfReferenceResolver()
		{
			Builder.BuildStarting += OnBuildStart;
		}

		private void OnBuildStart()
		{
			ClearCache();
		}

		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		// dynamic reference export doesnt work here

		public IExportContext Context { get; set; }

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			if (Context != null)
			{
				resolvers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IReferencedGltfResolver>().ToArray();
				var context = new GltfReferenceContext();
				context.Context = Context;
				context.Owner = instance;
				context.Value = value;
				foreach (var res in resolvers)
				{
					if (res.TryExport(context, out var result))
					{
						value = result;
						return true;
					}
				}

				if (value is IList<Transform> list)
				{
					var resultPaths = new List<string>();
					for (var index = 0; index < list.Count; index++)
					{
						var val = list[index];
						if (val && val != null && TryHandleExport(instance, val.gameObject, Context, out var resultPath))
						{
							resultPaths.Add(resultPath);
						}
					}
					if (resultPaths.Count > 0)
					{
						value = resultPaths;
						return true;
					}
				}
				else if (value is Transform transform)
				{
					if (transform && transform.gameObject && TryHandleExport(instance, transform.gameObject, Context, out var resultPath))
					{
						value = resultPath;
						return true;
					}
				}
			}

			// value = null;
			return false;
		}


		private static bool TryHandleExport(object owner, GameObject go, IExportContext context, out string path)
		{
			if (EditorUtility.IsPersistent(go))
			{
				path = null;
				if (go.TryGetComponent(out IExportableObject exp))
				{
					if (ExportReferencedObject(owner, go, go, exp, context, ref path))
						return true;
				}
			}
			path = null;
			return false;
		}

		private static readonly List<IBeforeExportGltf> BeforeExportGltfCallbackReceivers = new List<IBeforeExportGltf>();

		public static void Register(IBeforeExportGltf callbackReceiver)
		{
			BeforeExportGltfCallbackReceivers.Add(callbackReceiver);
		}

		public static bool ExportReferencedObject(object owner,
			Object source,
			GameObject instance,
			IExportableObject exp,
			IExportContext context,
			ref string path,
			bool force = false)
		{
			var resultPath = path;
			if (string.IsNullOrEmpty(resultPath))
				resultPath = context.AssetsDirectory + "/" + exp.name + context.GetExtension(instance);

			// ensure that when exporting we store the gameObject
			// and then nested / via Addressable try to export the transform of the same object
			// causing IOExceptions and export to break when trying to write to the same file twice
			var gameObject = source;
			if (SceneExportUtils.TryGetGameObject(gameObject, out var go))
				gameObject = go;

			if (exported.Contains(gameObject))
			{
				if (!force)
				{
					path = GetFinalPath(context.ProjectDirectory, resultPath);
					return true;
				}
			}
			else
			{
				exported.Add(gameObject);
			}

			foreach (var cb in BeforeExportGltfCallbackReceivers)
			{
				if (cb.OnBeforeExportGltf(resultPath, instance, context) == false)
				{
					return false;
				}
			}

			context.DependencyRegistry?.RegisterDependency(resultPath, context.Path, context);

			if (!DetectIfAssetHasChangedSinceLastExport(resultPath, source, context))
			{
				path = GetFinalPath(context.ProjectDirectory, resultPath);
				return true;
			}

			var obj = owner as Object;
			using (new Timer("<b>Exports:</b> <i>" + instance.name + ".glb</i>, referenced by " + (obj ? obj.name : owner), obj))
			{
				if (exp.Export(resultPath, false, context) || File.Exists(resultPath))
				{
					path = GetFinalPath(context.ProjectDirectory, resultPath);
					return true;
				}
			}
			path = null;
			return false;
		}

		private static string GetFinalPath(string basePath, string resultPath)
		{
			// referenced glbs should have a relative path to the source directory
			// and not require a ./ root path
			// this is crucial so exports via context menu work too
			return PathUtils.MakeRelative(basePath, resultPath);
		}

		private static bool DetectIfAssetHasChangedSinceLastExport(string outputPath, Object sourceAsset, IExportContext context)
		{
			// If this feature is disabled we always want to export
			if (ExporterProjectSettings.instance.smartExport == false)
			{
				return true;
			}

			// TODO: I think we dont need this anymore since we now pass in the source asset
			var assetPath = AssetDatabase.GetAssetPath(sourceAsset);
			if (!EditorUtility.IsPersistent(sourceAsset))
			{
				// if the object is set to hide and dont save it's a prefab temporary instantiated for export
				// TODO: this must be removed and we should merge this with Export.cs
				if (sourceAsset.hideFlags == HideFlags.HideAndDontSave)
				{
					assetPath = PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(sourceAsset);
					sourceAsset = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
				}
			}

			if (string.IsNullOrEmpty(assetPath) || !File.Exists(assetPath)) return true;

			var fileInfo = new FileInfo(outputPath);
			// If the file is less than 1KB, it's probably not a valid glTF file
			if (fileInfo.Exists && fileInfo.Length <= 1024) return true;
			
			var checkIfAssetHasChanged = !fileInfo.Exists;
			if (!checkIfAssetHasChanged && context is IHasBuildContext hasBuildContext)
			{
				if (hasBuildContext.BuildContext != null)
				{
					// never check if the asset has changed if we are exporting via context menu
					if (hasBuildContext.BuildContext.ViaContextMenu == false) 
						// also never check for dist builds
						checkIfAssetHasChanged = hasBuildContext.BuildContext.IsDistributionBuild && AssetDependencyCache.IsSupported;
				}
			}

			if (checkIfAssetHasChanged)
			{
				if (context.TryGetAssetDependencyInfo(sourceAsset, out var info))
				{
					if (!info.HasChanged)
					{
						if (File.Exists(outputPath))
						{
							var msg = "~ Skip exporting " + Path.GetFileName(outputPath) + " → it has not changed\nYou may disable " +
							          nameof(ExporterProjectSettings.instance.smartExport) +
							          " in <b>ProjectSettings/Needle</b> if you think this is not working correctly.";
							Debug.Log(msg.LowContrast());
							return false;
						}

						if (AssetDependencyCache.TryRestoreFromCache(outputPath))
						{
							var msg = "~ Restored from export cache " + Path.GetFileName(outputPath) + "\nYou may disable " +
							          nameof(ExporterProjectSettings.instance.smartExport) +
							          " in <b>ProjectSettings/Needle</b> if you think this is not working correctly.";
							Debug.Log(msg.LowContrast());
							return false;
						}
					}
					else
					{
						info.WriteToCache();
					}
				}
			}

			return true;
		}
	}
}