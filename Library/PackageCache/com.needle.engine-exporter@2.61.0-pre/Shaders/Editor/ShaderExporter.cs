using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Needle.Engine.Utils;
using Needle.Engine.Writer;
using UnityEditor;
using UnityEditor.Rendering;
using UnityEngine;
using UnityEngine.Assertions;

namespace Needle.Engine.Shaders
{
	public class ShaderExporter
	{
		private const string IfdefVertex = "#ifdef VERTEX";
		private const string IfdefFragment = "#ifdef FRAGMENT";
		private const string Endif = "#endif";

		public enum Mode
		{
			WebGL1, // ShaderCompilerPlatform.GLES20
			WebGL2, // ShaderCompilerPlatform.GLES3x
		}

		private class CompileInfo
		{
			public readonly int Id;
			public readonly Material Material;
			public readonly string[] Keywords;

			public CompileInfo(int id, Material material, string[] keywords)
			{
				this.Id = id;
				this.Material = material;
				this.Keywords = keywords;
			}
		}

		private readonly List<CompileInfo> compileList = new List<CompileInfo>();

		public void Clear()
		{
			compileList.Clear();
		}

		public int Add(Material mat)
		{
			var existing = compileList.FirstOrDefault(m => m.Material == mat);
			if (existing != null) return existing.Id;
			var keywords = GetKeywords(mat);
			existing = compileList.FirstOrDefault(m => m.Keywords.SequenceEqual(keywords));
			if (existing != null) return existing.Id;
			// TODO: sub shaders are not handled
			var newId = compileList.Count;
			var newInfo = new CompileInfo(newId, mat, keywords);
			compileList.Add(newInfo);
			return newInfo.Id;
		}

		public bool IsBeingUsed(Shader shader)
		{
			return shader != null && compileList.Any(e => e.Material.shader == shader);
		}

		public static string GetOutputName(Shader shader)
		{
			var id = shader.GetId();
			return $"{shader.name.Replace("/", "_").ToVariableName()}_{id}";
		}

		public static string[] GetKeywords(Material mat)
		{
			return mat.shaderKeywords.Distinct().OrderBy(kw => kw).ToArray();
		}
		
		public void GetData(Shader shader, int subshaderIndex, int passIndex, Mode webGLMode, out ExtensionData extensionData)
		{
			if (compileList.Count <= 0)
			{
				extensionData = null;
				return;
			}
			
			extensionData = new ExtensionData();
			var data = extensionData;

			var shaderId = 0;
			
			foreach (var info in compileList)
			{
				var shaderData = ShaderUtil.GetShaderData(shader);
				for (var i = 0; i < shaderData.SubshaderCount; i++)
				{
					if (subshaderIndex != i) continue;

					var subshader = shaderData.GetSubshader(i);
					for (int j = 0; j < subshader.PassCount; j++)
					{
						if (passIndex > -1 && j != passIndex) continue;
						
						info.Material.SetPass(0);
						var mesh = new Mesh();
						Graphics.DrawMeshNow(mesh, Matrix4x4.identity);

						var pass = subshader.GetPass(j);
						// special case: for WebGL + GLES20 we only need to compile the vertex type, it contains both vertex and fragment.
						var compileInfo = pass.CompileVariant(ShaderType.Vertex, info.Keywords, webGLMode == Mode.WebGL1 ? ShaderCompilerPlatform.GLES20 : ShaderCompilerPlatform.GLES3x, BuildTarget.WebGL);
						var compiledShaderData = compileInfo.ShaderData;

						// split into vertex and fragment part
						var str = Encoding.UTF8.GetString(compiledShaderData, 0, compiledShaderData.Length);

						// find vertex start
						var vertexStart = str.IndexOf(IfdefVertex, StringComparison.Ordinal);
						var fragmentStart = str.IndexOf(IfdefFragment, StringComparison.Ordinal);

						var vertexShader = str.Substring(vertexStart + IfdefVertex.Length, fragmentStart - vertexStart - IfdefVertex.Length - Endif.Length - 1);
						var fragmentShader = str.Substring(fragmentStart + IfdefFragment.Length,
							str.Length - fragmentStart - IfdefFragment.Length - Endif.Length - 1);

						// extract attributes and uniforms, we'll have to merge vertex and fragment again
						var attributes = new Dictionary<string, ExtensionData.ShaderAttribute>();
						var uniforms = new Dictionary<string, ExtensionData.ShaderUniform>();

						// attribute highp vec3 in_POSITION0;
						var attributeRegex = new Regex("attribute (?<precision>.*) (?<type>.*) (?<name>.*);");

						GetAttributes(vertexShader, attributeRegex, attributes);
						GetAttributes(fragmentShader, attributeRegex, attributes);

						// https://regex101.com/r/Iab0Yz/1
						// uniform 	vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
						// uniform 	vec4 _ColorB;
						// uniform lowp sampler2D

						var uniformRegex = new Regex(@"uniform\s+(?<precision>lowp|mediump|highp)?\s+(?<type>.+?)\s+(?<name>\w+)(\[(?<count>\d*)\])?");

						GetUniforms(vertexShader, uniformRegex, uniforms);
						GetUniforms(fragmentShader, uniformRegex, uniforms);

						// find fragment shader attributes
						// find vertex shader uniforms
						// find fragment shader uniforms

						var vertexUri = ExtensionData.Shader.GetUri(vertexShader);
						var fragmentUri = ExtensionData.Shader.GetUri(fragmentShader);

						// TODO filter keywords by which ones are valid for vertex/fragment pass (2021.2+)
						var validVertexKeywords = info.Keywords;
						var validFragmentKeywords = info.Keywords;

						var vertexId = shaderId++;
						var vertexShaderData = new ExtensionData.Shader()
						{
							name = pass.Name + string.Join("-", validVertexKeywords) + "-VERTEX",
							type = ExtensionData.ShaderType.Vertex,
							code = vertexShader,
							uri = vertexUri,
							id = vertexId,
						};
						vertexShaderData.filePath = GetFileExportPath(shader, vertexShaderData, "");
						data.shaders.Add(vertexShaderData);
						
						var fragmentId = shaderId++;
						var fragmentShaderData = new ExtensionData.Shader()
						{
							name = pass.Name + string.Join("-", validFragmentKeywords) + "-FRAGMENT",
							type = ExtensionData.ShaderType.Fragment,
							code = fragmentShader,
							uri = fragmentUri,
							id = fragmentId,
						};
						fragmentShaderData.filePath = GetFileExportPath(shader, fragmentShaderData, "");
						data.shaders.Add(fragmentShaderData);

						var progId = info.Id;
						data.programs.Add(new ExtensionData.Program()
						{
							vertexShader = vertexId,
							fragmentShader = fragmentId,
							id = progId,
						});

						data.techniques.Add(new ExtensionData.Technique()
						{
							program = progId,
							attributes = attributes,
							uniforms = uniforms,
							defines = info.Keywords,
						});
					}
				}
			}
		}

		public static string GetFileExportPath(Shader shader, ExtensionData.Shader shaderData, string outputDir)
		{
			var shaderName = shader.name.Replace("/", "_");
			var dataName = shaderData.name;
			var typeExt = shaderData.type == ExtensionData.ShaderType.Vertex ? "vert" : "frag";
			var path = Path.Combine(outputDir, $"{shaderName}-{dataName}-{typeExt}.glsl");
			return path;
		}

		public static void ExportToFile(Shader shader, ExtensionData.Shader shaderData, string outputDir)
		{
			if (!Directory.Exists(outputDir)) Directory.CreateDirectory(outputDir);
			File.WriteAllText(GetFileExportPath(shader, shaderData, outputDir), shaderData.code);
		}
		
		private void GetAttributes(string shaderCode, Regex attributeRegex, Dictionary<string, ExtensionData.ShaderAttribute> attributes)
		{
			// find vertex shader attributes
			var vertexAttributeGroups = attributeRegex.Matches(shaderCode);
			foreach (Match match in vertexAttributeGroups)
			{
				// Debug.Log(match);
				// should be 3 captures
				Assert.AreEqual(4, match.Groups.Count, $"String was: {match}, group count {match.Groups.Count}");
				// var precision = match.Groups["precision"].Value;
				// var type = match.Groups["type"].Value;
				var name = match.Groups["name"].Value;

				attributes.Add(name, new ExtensionData.ShaderAttribute()
				{
					semantic = ExtensionData.ShaderAttribute.SemanticFromName(name).ToString(),
				});
			}
		}

		private static void GetUniforms(
			string shaderCode,
			Regex uniformRegex,
			IDictionary<string, ExtensionData.ShaderUniform> uniforms
		)
		{
			// find vertex shader attributes
			var groups = uniformRegex.Matches(shaderCode);
			foreach (Match match in groups)
			{
				// should be 3 captures
				Assert.IsTrue(match.Groups.Count >= 3 && match.Groups.Count <= 6,
					$"String was: {match}, group count {match.Groups.Count}");

				var type = match.Groups["type"].Value;
				var name = match.Groups["name"].Value;
				var count = 1;
				if (int.TryParse(match.Groups["count"]?.Value, out var parsedCount))
					count = parsedCount;

				if(!uniforms.ContainsKey(name))
				{
					uniforms.Add(name, new ExtensionData.ShaderUniform()
					{
						count = count,
						name = name,
						type = ExtensionData.ShaderUniform.TypeFromTypeString(type),
						semantic = ExtensionData.ShaderUniform.SemanticFromName(name),
					});
				}
			}
		}
	}
}