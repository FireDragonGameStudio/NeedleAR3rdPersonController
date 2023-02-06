using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using GLTF.Schema;
using JetBrains.Annotations;
using Needle.Engine.Gltf;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Android;
using UnityEngine.Rendering;

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl

namespace Needle.Engine.Shaders.Extensions
{
	[UsedImplicitly]
	public class UnityGltfCustomShader : GltfCustomMaterialExtensionHandler
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
		}

		public override void OnAfterMaterialExport(GltfExportContext context, Material material, int materialId)
		{
			var shader = material.shader;
			var exporter = ShaderExporterRegistry.IsMarkedForExport(shader, true);
			var markedForExport = exporter && exporter.enabled;

			if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(shader);
			if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(material);
			
			if (!markedForExport) return;

			base.OnAfterMaterialExport(context, material, materialId);

			var renderer = default(Renderer);
			// ReSharper disable ExpressionIsAlwaysNull
			var block = renderer ? new MaterialPropertyBlock() : default;
			if (renderer) renderer.GetPropertyBlock(block);
			var props = ShaderPropertyExtensions.EnumerateProperties(material, block).ToList();
			foreach (var prop in props)
			{
				if (prop.Value is TexturePropertyInfo ti && ti.Texture)
				{
					context.Bridge.AddTexture(ti.Texture);
				}
			}

			// Not sure if we should add the alpha mode as a material uniform.
			// It should probably instead be added to the material root extension?
			// See https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl#shader-requirements
			if (material.renderQueue >= 3000)
			{
				props.Add(new ShaderPropertyInfo(){Name = "alphaMode", Value = "BLEND"});
			}
			
			// ReSharper enable ExpressionIsAlwaysNull
			var tech = new MaterialTechniquesExtension_Material(context.Bridge, this, material, props);
			context.Bridge.AddMaterialExtension(materialId, MaterialTechniquesExtension_Material.EXTENSION_NAME, tech);
		}

		public override void OnAfterExport(GltfExportContext context)
		{
			base.OnAfterExport(context);
			// if (this.allMaterials.Count > 0)
			// {
			// 	var bridge = context.Bridge;
			// 	var ext = new CustomMaterialExtension(this.allMaterials);
			// 	context.Bridge.AddExtension(CustomMaterialExtension.EXTENSION_NAME, ext);
			// 	foreach (var kvp in this.materialsReferenced)
			// 	{
			// 		var nodeId = kvp.Key;
			// 		var materials = kvp.Value;
			// 		var refext = new CustomMaterialReferenceExtension(ext, materials);
			// 		bridge.AddNodeExtension(nodeId, CustomMaterialReferenceExtension.EXTENSION_NAME, refext);
			// 	}
			// }

			if (shaders?.programs?.Count > 0)
				context.Bridge.AddExtension(NEEDLE_techniques_webgl.EXTENSION_NAME, new NEEDLE_techniques_webgl(shaders));
		}
	}

	public class MaterialTechniquesExtension_Material : IExtension
	{
		public const string EXTENSION_NAME = NEEDLE_techniques_webgl.EXTENSION_NAME;

		private readonly GltfCustomMaterialExtensionHandler handler;
		private readonly Material material;
		private readonly IList<ShaderPropertyInfo> properties;
		private readonly IGltfBridge bridge;

		public MaterialTechniquesExtension_Material(IGltfBridge bridge,
			GltfCustomMaterialExtensionHandler handler,
			Material material,
			IList<ShaderPropertyInfo> properties)
		{
			this.bridge = bridge;
			this.handler = handler;
			this.material = material;
			this.properties = properties;
		}

		public JProperty Serialize()
		{
			var obj = new JObject();
			if (this.handler.TryGetTechniqueIndex(this.material, out var index))
			{
				obj.Add("technique", index);

				var values = new JObject();
				obj.Add("values", values);

				foreach (var prop in properties)
				{
					var name = prop.Name;
					if (values[name] != null)
					{
						Debug.LogWarning("Property \"" + name + "\" already added: " + this.material.shader, this.material);
						continue;
					}
					switch (prop.Value)
					{
						case string val:
							values.Add(name, val);
							break;
						case Color col:
							var colorArr = new JArray();
							for (var i = 0; i < 4; i++) colorArr.Add(col[i]);
							values.Add(name, colorArr);
							break;
						case Vector4 vec:
							var vecArr = new JArray();
							for (var i = 0; i < 4; i++) vecArr.Add(vec[i]);
							values.Add(name, vecArr);
							break;
						case int val:
							values.Add(name, val);
							break;
						case float val:
							values.Add(name, new JRaw(val));
							break;
						case TexturePropertyInfo info:
							var tex = info.Texture;
							// TODO: we need to export the texture additionally before serialize
							values.Add(name, this.bridge.TryGetTextureId(tex).AsTexturePointer());
							var samplerArr = new JArray();
							for (var i = 0; i < 4; i++) samplerArr.Add(info.SamplerState[i]);
							values.Add(name + "_ST", samplerArr);
							break;
					}
				}
			}


			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new MaterialTechniquesExtension_Material(this.bridge, this.handler, material, properties);
		}
	}

	// public class CustomMaterialReferenceExtension : IExtension
	// {
	// 	public const string EXTENSION_NAME = "NEEDLE_custom_material_reference";
	//
	// 	public readonly CustomMaterialExtension materialExtension;
	// 	public readonly List<Material> materials;
	//
	// 	public CustomMaterialReferenceExtension(CustomMaterialExtension ext, List<Material> materials)
	// 	{
	// 		this.materialExtension = ext;
	// 		this.materials = materials;
	// 	}
	//
	// 	public JProperty Serialize()
	// 	{
	// 		var obj = new JObject();
	// 		foreach (var mat in this.materials)
	// 		{
	// 			obj.Add(mat.name, this.materialExtension.GetPathFor(mat));
	// 		}
	// 		return new JProperty(EXTENSION_NAME, obj);
	// 	}
	//
	// 	public IExtension Clone(GLTFRoot root)
	// 	{
	// 		return new CustomMaterialReferenceExtension(this.materialExtension, this.materials);
	// 	}
	// }
	//
	// public class CustomMaterialExtension : IExtension
	// {
	// 	public const string EXTENSION_NAME = "NEEDLE_custom_material";
	//
	// 	public readonly IList<Material> materials;
	//
	// 	public CustomMaterialExtension(IList<Material> materials)
	// 	{
	// 		this.materials = materials;
	// 	}
	//
	// 	private Dictionary<Material, string> paths;
	//
	// 	public JProperty Serialize()
	// 	{
	// 		Debug.Log("Serialize root");
	// 		var obj = new JObject();
	// 		return new JProperty(EXTENSION_NAME, obj);
	// 	}
	//
	// 	public IExtension Clone(GLTFRoot root)
	// 	{
	// 		return new CustomMaterialExtension(this.materials);
	// 	}
	//
	// 	public string GetPathFor(Material mat)
	// 	{
	// 		paths ??= new Dictionary<Material, string>();
	// 		if (paths.TryGetValue(mat, out var path)) return path;
	// 		var index = this.materials.IndexOf(mat);
	// 		if (index < 0)
	// 		{
	// 			paths.Add(mat, null);
	// 			return null;
	// 		}
	// 		path = "nodes/0/extension/" + EXTENSION_NAME + "/" + index;
	// 		paths.Add(mat, path);
	// 		return path;
	// 	}
	// }
}