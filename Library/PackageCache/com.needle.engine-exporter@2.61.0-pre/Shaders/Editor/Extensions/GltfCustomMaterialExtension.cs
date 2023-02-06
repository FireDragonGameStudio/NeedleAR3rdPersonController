using System;
using System.Collections.Generic;
using System.Reflection;
using Needle.Engine.Gltf;
using Needle.Engine.Utils;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Needle.Engine.Shaders.Extensions
{
	/// <summary>
	/// Used to export every shader with every configuration only once
	/// </summary>
	public readonly struct ShaderExportConfiguration
	{
		public readonly Material Material;
		public readonly UnityEngine.Shader Shader;
		public readonly int SubShaderIndex;
		public readonly int PassIndex;
		public readonly ShaderExporter.Mode Mode;


		public ShaderExportConfiguration(ShaderExportAsset asset, Material material)
		{
			this.Material = material;
			if (asset)
			{
				this.Shader = asset.shader;
				this.SubShaderIndex = asset.subshaderIndex;
				this.PassIndex = asset.passIndex;
				this.Mode = asset.mode;
			}
			else
			{
				this.Shader = material.shader;
				this.SubShaderIndex = 0;
				this.PassIndex = 0;
				this.Mode = ShaderExporter.Mode.WebGL2;
			}
		}
	}

	public abstract class GltfCustomMaterialExtensionHandler : GltfExtensionHandlerBase
	{
		protected readonly Dictionary<int, List<Material>> materialsReferenced = new Dictionary<int, List<Material>>();
		protected readonly List<Material> allMaterials = new List<Material>();

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			materialsReferenced.Clear();
			allMaterials.Clear();
			shaders.Clear();
			shaderTechniqueMap.Clear();
			exportedShaders.Clear();
		}

		protected readonly ExtensionData shaders = new ExtensionData();

		private readonly Dictionary<Material, int> shaderTechniqueMap = new Dictionary<Material, int>();
		private readonly ShaderExporter shaderExporter = new ShaderExporter();
		private readonly ThreeShaderPostProcessor postProcessor = new ThreeShaderPostProcessor();
		private readonly HashSet<ShaderExportConfiguration> exportedShaders = new HashSet<ShaderExportConfiguration>();

		public bool TryGetTechniqueIndex(Material mat, out int index)
		{
			if (!mat)
			{
				index = -1;
				return false;
			}
			return shaderTechniqueMap.TryGetValue(mat, out index);
		}

		public override void OnAfterMaterialExport(GltfExportContext context, Material material, int materialId)
		{
			base.OnAfterMaterialExport(context, material, materialId);
			var shader = material.shader;
			// FIXME: this does currently return the first asset that has this shader 
			// so if we have multiple assets having different configs for the same shader 
			// we cant do that right now and only the first one will be used (e.g. export pass 0 and pass 1)
			// SOME of the code below already assumes it is possible but for some cases we also need other info
			// e.g. context for where do we want to use which shader pass then...
			var exporter = ShaderExporterRegistry.IsMarkedForExport(shader);
			var markedForExport = exporter && exporter.enabled;

			if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(shader);
			if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(material);

			if (!markedForExport) return;

			// make sure we export every ShaderAsset with every configuration only once
			var key = new ShaderExportConfiguration(exporter, material);
			if (exportedShaders.Contains(key)) return;
			exportedShaders.Add(key);
			
			// TODO: add caching

			// compile the shader to get technique, programs, uniforms
			shaderExporter.Clear();
			shaderExporter.Add(material);
			shaderExporter.GetData(shader, key.SubShaderIndex, key.PassIndex, key.Mode, out var data);
			if (data == null || data.techniques.Count <= 0)
			{
				Debug.LogError("Custom shader export failed - didnt get techniques: " + shader, material);
				return;
			}
			postProcessor.PostProcessShaders(data);
			AddShader(material, data);
		}

		/// <summary>
		/// adds the shader to a single shader techniques, programs, uniforms files as defined in the spec
		/// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl#extension
		/// It inserts and updates the new indices accordingly
		/// </summary>
		private void AddShader(Material mat, ExtensionData newData)
		{
			var technique = newData.techniques[0];
			var techniqueIndex = this.shaders.techniques.Count;
			// technically we would need to save the whole config here
			// e.g. when a shader is exported for multiple passes
			// but then we would need to know that info when serializing the material extension too
			this.shaderTechniqueMap.Add(mat, techniqueIndex);
			this.shaders.techniques.Add(technique);

			var program = newData.programs[0];
			technique.program = this.shaders.programs.Count;
			program.id = technique.program;
			this.shaders.programs.Add(program);

			var frag = newData.shaders[program.fragmentShader];
			program.fragmentShader = this.shaders.shaders.Count;
			this.shaders.shaders.Add(frag);

			var vert = newData.shaders[program.vertexShader];
			program.vertexShader = this.shaders.shaders.Count;
			this.shaders.shaders.Add(vert);
		}
	}
}