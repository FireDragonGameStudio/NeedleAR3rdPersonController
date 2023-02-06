using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using GLTF.Schema;
using Needle.Engine.Core.References;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityGLTF;

namespace Needle.Engine.Gltf.UnityGltf
{
	/// <summary>
	/// Base extension export component for UnityGltf, called from GltfObject component to invoke events on ExtensionHandler implementors
	/// </summary>
	[GltfExportHandler(GltfExporterType.UnityGLTF)]
	public class UnityGltfExportHandler : IGltfExportHandler
	{
		private List<IGltfExtensionHandler> extensionHandlers;
		private GltfExportContext currentContext;
		private UnityGltfBridge bridge;
		private Transform transform;
		private GLTFSettings settings;

		public GltfExporterType Type => GltfExporterType.UnityGLTF;

		internal GltfExportContext Context => currentContext;
		internal List<IGltfExtensionHandler> ExtensionHandlers => extensionHandlers;

		internal static void EnsureExportSettings(GLTFSettings settings)
		{
			settings.ExportNames = true;
			settings.ExportFullPath = false;
			settings.RequireExtensions = false;

			settings.UseMainCameraVisibility = false;
			settings.ExportDisabledGameObjects = true;

			settings.TryExportTexturesFromDisk = false;
			settings.UseTextureFileTypeHeuristic = true;
			settings.DefaultJpegQuality = 100;

			settings.ExportAnimations = true;
			settings.UseAnimationPointer = true;
			settings.UniqueAnimationNames = false;
			settings.BakeSkinnedMeshes = false;

			settings.BlendShapeExportProperties = GLTFSettings.BlendShapeExportPropertyFlags.PositionOnly | GLTFSettings.BlendShapeExportPropertyFlags.Normal;
			settings.BlendShapeExportSparseAccessors = true;
			settings.ExportVertexColors = true;
			
			settings.UseCaching = true;
		}

		public Task<bool> OnExport(Transform t, string path, IExportContext ctx)
		{
#if UNITY_EDITOR
			this.transform = t;
			extensionHandlers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IGltfExtensionHandler>();

			// callbacks 
			var opts = new GltfExportOptions();

			if (!settings) settings = ScriptableObject.CreateInstance<GLTFSettings>();
			EnsureExportSettings(settings);

			var exporter = ExportUtils.GetExporter(t, out var exportOptions, opts, settings);
			exportOptions.BeforeSceneExport += OnBeforeExport;
			exportOptions.AfterNodeExport += OnAfterNodeExport;
			exportOptions.AfterSceneExport += OnAfterExport;
			exportOptions.BeforeMaterialExport += OnBeforeMaterialExport;
			exportOptions.AfterMaterialExport += OnAfterMaterialExport;
			exportOptions.BeforeTextureExport += OnBeforeTextureExport;
			exportOptions.AfterTextureExport += OnAfterTextureExport;
			exportOptions.AfterPrimitiveExport += OnAfterPrimitiveExport;

			var reg = new ReferenceRegistry(ctx.TypeRegistry.KnownTypes);
			bridge = new UnityGltfBridge(exporter);
			this.currentContext = new GltfExportContext(this, path, t, ctx, reg, reg, bridge, GltfValueResolver.Default, exporter);
			this.currentContext.AssetsDirectory = Path.GetDirectoryName(path);
			this.currentContext.AssetExtension = new UnityGltfPersistentAssetExtension(this.currentContext);
			this.currentContext.DependencyRegistry = new DependencyRegistry(this.currentContext);
			reg.Context = this.currentContext;

			var animationPreviewState = AnimationWindowUtil.IsPreviewing();
			if (animationPreviewState) AnimationWindowUtil.StopPreview();
			try
			{
				Debug.Log("→ <b>Export</b> " + t.name);
				ExportUtils.ExportWithUnityGltf(exporter, path, path.EndsWith(".glb"));
				OnExportFinished();
			}
			finally
			{
				if (animationPreviewState) AnimationWindowUtil.StartPreview();
				this.OnCleanup();
			}
#endif
			return Task.FromResult(true);
		}

		private void OnBeforeExport(GLTFSceneExporter exporter, GLTFRoot root)
		{
			TextureExportHandlerRegistry.BeforeExport();
			
			foreach (var handler in extensionHandlers)
			{
				handler.OnBeforeExport(currentContext);
			}
		}

		private void OnAfterNodeExport(GLTFSceneExporter exporter, GLTFRoot root, Transform t, Node node)
		{
			foreach (var h in extensionHandlers)
			{
				h.OnAfterNodeExport(currentContext, t, exporter.GetTransformIndex(t));
			}
		}

		private void OnBeforeTextureExport(GLTFSceneExporter exporter, ref GLTFSceneExporter.UniqueTexture obj, string textureSlot)
		{
			var textureSettings = obj.FromUnique();
			foreach (var handler in extensionHandlers)
			{
				handler.OnBeforeTextureExport(currentContext, ref textureSettings, textureSlot);
			}
			textureSettings.ApplyToUnique(ref obj);
		}

		private void OnAfterTextureExport(GLTFSceneExporter exporter, GLTFSceneExporter.UniqueTexture obj, int id, GLTFTexture tex)
		{
			var textureSettings = obj.FromUnique();
			foreach (var handler in extensionHandlers)
			{
				handler.OnAfterTextureExport(currentContext, id, textureSettings);
			}
		}

		private bool OnBeforeMaterialExport(GLTFSceneExporter exporter, GLTFRoot root, Material material, GLTFMaterial node)
		{
			var id = root.Materials.IndexOf(node);
			foreach (var handler in extensionHandlers)
			{
				handler.OnBeforeMaterialExport(currentContext, material, id);
			}
			return false;
		}

		private void OnAfterMaterialExport(GLTFSceneExporter exporter, GLTFRoot root, Material material, GLTFMaterial node)
		{
			var id = root.Materials.IndexOf(node);
			foreach (var handler in extensionHandlers)
			{
				handler.OnAfterMaterialExport(currentContext, material, id);
			}
			currentContext.Debug?.WriteDebugReferenceInfo(node, "material", material);
		}

		private readonly List<object> primitiveExtensions = new List<object>();

		private void OnAfterPrimitiveExport(GLTFSceneExporter exporter, Mesh mesh, MeshPrimitive primitive, int index)
		{
			if (index > 0) return;
			primitiveExtensions.Clear();
			foreach (var handler in extensionHandlers)
			{
				handler.OnAfterMeshExport(currentContext, mesh, primitiveExtensions);
			}

			if (primitiveExtensions.Count > 0)
			{
				var root = exporter.GetRoot();
				root.ExtensionsUsed ??= new List<string>();
			
				foreach (var ext in primitiveExtensions)
				{
					var name = ext.GetType().Name;
					var obj = JObject.Parse(this.Context.Serializer.Serialize(ext));
					if (primitive.Extensions != null && primitive.Extensions.ContainsKey(name))
						primitive.Extensions[name] = new UnityGltfOpaqueExtension(name, obj);
					else
						primitive.AddExtension(name, new UnityGltfOpaqueExtension(name, obj));

					if(!root.ExtensionsUsed.Contains(name))
						root.ExtensionsUsed.Add(name);
				}
			}
		}

		private void OnAfterExport(GLTFSceneExporter exporter, GLTFRoot root)
		{
			foreach (var handler in extensionHandlers)
			{
				handler.OnAfterExport(currentContext);
			}

			if (this.currentContext.DependencyRegistry?.Count > 0)
			{
				root.AddExtension(UnityGltf_NEEDLE_gltf_dependencies.EXTENSION_NAME,
					new UnityGltf_NEEDLE_gltf_dependencies(this.currentContext, this.currentContext.DependencyRegistry));
				root.ExtensionsUsed ??= new List<string>();
				if(!root.ExtensionsUsed.Contains(UnityGltf_NEEDLE_gltf_dependencies.EXTENSION_NAME))
					root.ExtensionsUsed.Add(UnityGltf_NEEDLE_gltf_dependencies.EXTENSION_NAME);
			}

			currentContext.AssetExtension.AddExtension(currentContext.Bridge);
		}

		private void OnExportFinished()
		{
			foreach (var handler in extensionHandlers)
			{
				handler.OnExportFinished(currentContext);
			}
		}

		private void OnCleanup()
		{
			foreach (var handler in extensionHandlers)
			{
				handler.OnCleanup();
			}

			this.currentContext?.Debug?.Flush();
		}
	}
}