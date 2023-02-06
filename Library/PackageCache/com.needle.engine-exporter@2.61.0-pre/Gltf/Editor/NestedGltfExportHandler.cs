using System;
using System.Collections.Generic;
using JetBrains.Annotations;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	internal struct NestedGltfInfo
	{
		public readonly GameObject GameObject;
		public readonly string PreviousEditorTag;
		public GameObject Created;
		public readonly Action Resetting;

		public NestedGltfInfo(GameObject go, Action resetting = null)
		{
			this.GameObject = go;
			this.PreviousEditorTag = go.tag;
			Created = null;
			Resetting = resetting;
		}

		public void Reset()
		{
			if (Resetting != null)
			{
				try
				{
					Resetting?.Invoke();
				}
				catch (Exception e)
				{
					Debug.LogException(e);
				}
			}
			GameObject.tag = PreviousEditorTag;
			Created.SafeDestroy();
		}
	}

	/// <summary>
	/// When a gltf object is nested in another gltf export process it should not be embedded in the gltf directly
	/// But instead we want the nested gltf object be exported to its own file
	/// That way we can for example add already compressed gltf objects to the scene
	/// and on export they will just be copied to the output directory
	/// </summary>
	[UsedImplicitly]
	public class NestedGltfExportHandler : GltfExtensionHandlerBase
	{
		private readonly List<NestedGltfInfo> _nestedGltfGameObjects = new List<NestedGltfInfo>();

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			if (ShouldRunNestedGlbExport(context))
			{
				var root = context.Root;
				_nestedGltfGameObjects.Clear();
				TraverseHierarchyForNestedGltfObjects(root, context, _nestedGltfGameObjects);
			}
		}

		public override void OnCleanup()
		{
			base.OnCleanup();
			foreach (var nested in _nestedGltfGameObjects)
			{
				nested.Reset();
			}
		}

		private static bool ShouldRunNestedGlbExport(GltfExportContext context)
		{
			var isNestedGlbExport = context.ParentContext != null;
			if (isNestedGlbExport)
			{
				var parent = context.ParentContext;
				switch (parent)
				{
					// when we export from within a referenced scene (or an object via menu item)
					case ExportContext _:
					case ObjectExportContext _:
					case GltfExportContext _:
						return true;
				}
			}
			return false;
		}

		private static void TraverseHierarchyForNestedGltfObjects(Transform current, GltfExportContext context, List<NestedGltfInfo> list)
		{
			// if this GameObject is a nested gltf we handle export
			// otherwise we walk recursively through its children
			if (!ReferenceEquals(current, context.Root) && current.TryGetComponent(out IExportableObject nested))
			{
				if (current.CompareTag("EditorOnly"))
				{
					// The object was marked as editor only by the user
					// Dont export it!
					return;
				}
				if (ReferenceEquals(current, context.Root))
				{
					// if this is the object we are exporting
					return;
				}

				var path = context.AssetsDirectory + "/" + nested.name.ToFileName() + context.GetExtension(current.gameObject);
				if (context.IsCurrentlyExportingToPath(path))
				{
					Debug.LogError("<b>Error exporting nested gltf</b>: Can not export nested gltf object to the same path as the parent gltf object: " + path + " in " + context.Root, context.Root);
					return;
				}
				var prevSettings = context.Settings;
				try
				{
					var exportSettings = context.Settings?.Clone() ?? new ExportSettings();
					// export skybox if a camera is found
					exportSettings.ExportSkybox = current.GetComponentInChildren<Camera>(true);
					// exportSettings.SetExtensionAllowed(UnityGltf_NEEDLE_lighting_settings.EXTENSION_NAME, false);
					context.Settings = exportSettings;
					if (nested.Export(path, false, context))
					{
						var gltfObjectRoot = current;
						// if the gltf object was exported successfully
						// save the current editor tag and mark it as editor only
						// var onReset = new Action(() => gltfObjectRoot.ApplyTransform(transformData));
						var cmd = new ExportNestedGltfCommand(gltfObjectRoot, context, path, nested);
						var info = new NestedGltfInfo(current.gameObject, () => cmd.Undo());
						cmd.Perform();
						info.Created = cmd.CreatedGameObject;
						list.Add(info);
					}
				}
				finally
				{
					context.Settings = prevSettings;
				}
			}
			// only traverse the hierarchy further if THIS GameObject is not a nested gltf
			else
			{
				foreach (Transform ch in current)
				{
					TraverseHierarchyForNestedGltfObjects(ch, context, list);
				}
			}
		}

		private static void RegisterStableGuid(Object obj, Object guidSource, GltfExportContext context)
		{
			if (!guidSource)
			{
				Debug.LogError(
					"Guid source for nested gltf export is not provided. This is probably because the exporting object is not a Unity component? Please report this as a bug with as much information as possible. The issue happened while exporting a nested gltf in " +
					context.Path);
				return;
			}
			var guid = guidSource.GetId();
			// using the version with dashes because that's what Unity's guids look like too
			var stableGuid = GuidGenerator.GetGuid(guid);
			context.RegisterGuid(obj, stableGuid);
		}

		private class ExportNestedGltfCommand : ICommand
		{
			private readonly Transform gltfRoot;
			private readonly GltfExportContext context;
			private readonly string path;
			private readonly IExportableObject nested;

			public GameObject CreatedGameObject { get; private set; }

			public ExportNestedGltfCommand(Transform gltfRoot, GltfExportContext context, string path, IExportableObject nested)
			{
				this.gltfRoot = gltfRoot;
				this.context = context;
				this.path = path;
				this.nested = nested;
			}

			public void Perform()
			{
				var createdGo = new GameObject(gltfRoot.name);
				CreatedGameObject = createdGo;
				createdGo.hideFlags = HideFlags.DontSave;
				createdGo.transform.parent = gltfRoot.parent;
				createdGo.layer = gltfRoot.gameObject.layer;
				gltfRoot.tag = "EditorOnly";
				createdGo.transform.ApplyTransform(gltfRoot.SaveTransform());
				// gltfObjectRoot.SetLocalIdentity();

				var nestedGltfComponent = createdGo.AddComponent<NestedGltf>();
				nestedGltfComponent.FilePath = PathUtils.MakeRelative(context.ProjectDirectory + "/", path);

				// TODO: make filePaths relative from currently exported gltf so they can be resolved without relying on project structure. e.g. when exporting a hierarchy via context menu and then use it in another project we must search relative
				// if (!nestedGltfComponent.FilePath.StartsWith("./")) nestedGltfComponent.FilePath = "./" + nestedGltfComponent.FilePath;

				RegisterStableGuid(createdGo, gltfRoot, context);
				RegisterStableGuid(nestedGltfComponent, nested as Object, context);
			}

			public void Undo()
			{
			}
		}
	}
}