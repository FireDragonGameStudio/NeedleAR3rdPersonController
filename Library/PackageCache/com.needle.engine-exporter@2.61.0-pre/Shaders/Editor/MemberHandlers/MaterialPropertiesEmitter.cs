// using JetBrains.Annotations;
// using Needle.Engine.Core;
// using Needle.Engine.Interfaces;
// using Needle.Engine.Utils;
// using Needle.Engine.Writer;
// using UnityEngine;
//
// namespace Needle.Engine.Shaders.MemberHandlers
// {
// 	[UsedImplicitly]
// 	public class MaterialPropertiesEmitterCodegen : IAdditionalEmitterCodegen
// 	{
// 		public void EmitAdditionalData(ExportContext context, object target, string currentPath)
// 		{
// 			if (target is Renderer rend)
// 			{
// 				string materialPropertiesPath = null;
// 				var writer = context.Writer;
// 				var block = new MaterialPropertyBlock();
// 				for (var index = 0; index < rend.sharedMaterials.Length; index++)
// 				{
// 					var mat = rend.sharedMaterials[index];
// 					if (!mat) continue;
// 					var shader = mat.shader;
// 					if (!shader) continue;
// 					
// 					var exporter = ShaderExporterRegistry.IsMarkedForExport(shader);
// 					var markedForExport = exporter && exporter.enabled;
//
// 					if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(shader);
// 					if (!markedForExport) markedForExport |= ShaderExporterRegistry.HasExportLabel(mat);
//
// 					if (!markedForExport) continue;
//
// 					block.Clear();
// 					rend.GetPropertyBlock(block);
//
// 					if (exporter)
// 					{
// 						if (materialPropertiesPath == null)
// 						{
// 							materialPropertiesPath = $"{currentPath}.materialProperties";
// 							writer.Write($"{materialPropertiesPath} = [");
// 							writer.Indentation++;
// 						}
// 						
// 						writer.BeginBlock();
// 						if (exporter.IsUsingCustomPath)
// 							writer.Write($"\"@__path\" : \"{exporter.customPath}\",");
// 						else
// 							writer.Write($"\"@__data\" : shaders.{ShaderExporter.GetOutputName(mat.shader)},");
// 						context.References.RegisterField( materialPropertiesPath + "[" + index + "][\"@__data\"]",  target, null, mat);
// 						writer.Write($"\"@__id\" : {exporter.Add(mat)},");
// 						
// 						if (mat.HasProperty("_Cull"))
// 						{
// 							var val = mat.GetInt("_Cull");
// 							writer.Write($"cull : {val},");
// 						}
// 						else if (mat.HasProperty("_CullMode"))
// 						{
// 							var val = mat.GetInt("_CullMode");
// 							writer.Write($"cull : {val},");
// 						}
// 						
// 						writer.Write("uniforms : {");
// 						writer.Indentation++;
//
// 						foreach (var prop in ShaderPropertyExtensions.EnumerateProperties(mat, block))
// 						{
// 							var name = prop.Name;
// 							switch (prop.Value)
// 							{
// 								case Color col:
// 									writer.Write($"{name} : new THREE.Vector4({col.r}, {col.g}, {col.b}, {col.a}),");
// 									break;
// 								case Vector4 vec:
// 									writer.Write($"{name} : new THREE.Vector4({vec.x}, {vec.y}, {vec.z}, {vec.w}),");
// 									break;
// 								case float val:
// 									writer.Write($"{name} : {val},");
// 									break;
// 								case TexturePropertyInfo info:
// 									var tex = info.Texture;
// 									writer.Write($"{name} : \"{tex.GetId()}\",");
// 									var samplerState = info.SamplerState;
// 									writer.Write($"{info.SamplerStateName} :new THREE.Vector4{samplerState},");
// 									break;
// 							}
// 						}
// 						
// 						writer.Indentation--;
// 						writer.Write("},");
// 						writer.EndBlock(",");
// 					}
// 				}
// 				if (materialPropertiesPath != null)
// 				{
// 					writer.Indentation -= 1;
// 					writer.Write("];");
// 				}
// 			}
// 		}
// 	}
// }