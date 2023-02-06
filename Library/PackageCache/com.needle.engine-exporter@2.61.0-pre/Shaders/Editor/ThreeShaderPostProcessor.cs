using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Needle.Engine.Shaders
{
	public class ThreeShaderPostProcessor
	{
		public void PostProcessShaders(ExtensionData data)
		{
			if (data == null) return;
			foreach (var sh in data.shaders)
				PostProcessShader(sh);
		}

		// https://regex101.com/r/ji65Gq/1
		private static readonly Regex blockStartRegex = new Regex(@".*?uniform\s+.+?\s+\{", RegexOptions.Compiled);

		private static readonly Regex replaceLayoutRegex = new Regex(@"layout\(.+?\)\s+?");

		// https://regex101.com/r/5966Ku/1
		private static readonly Regex removeUpperCaseDefinesWithArg = new Regex(@"[A-Z_]+\(\d\)\s+?");

		public void PostProcessShader(ExtensionData.Shader shader)
		{
			if (shader == null) throw new ArgumentNullException(nameof(shader));

			var code = shader.code;
			var didHaveCode = !string.IsNullOrWhiteSpace(code);
			if (string.IsNullOrEmpty(code))
			{
				if (string.IsNullOrEmpty(shader.uri))
				{
					code = ExtensionData.Shader.GetCode(shader.uri);
				}
			}

			if (string.IsNullOrWhiteSpace(code)) throw new Exception("No shader code provided for " + shader.name);
			var reader = new StringReader(code);
			var res = new StringBuilder();
			var foundAnyText = false;

			string line;
			var isInUnsupportedUniformBlock = false;
			do
			{
				line = reader.ReadLine();
				if (line != null)
				{
					if (line.Contains("#version"))
					{
						line = line.Replace("310", "300");
						line += "\n// downgraded version from 310 (unsupported shader version)";
					}
					if (!foundAnyText && string.IsNullOrWhiteSpace(line)) continue;
					
					var isInvalidLine = false;
					if (line.StartsWith("#define") || line.StartsWith("#if") || line.StartsWith("#endif") || line.StartsWith("#else"))
					{
						if(!line.StartsWith("#define SV_TARGET0 gl_FragData[0]")) // WebGL1-specific
						{
							line = "// " + line;
							isInvalidLine = true;
						}
					}
					if (line.Contains("precision mediump float;")) // WebGL1-specific
					{
						line = "// " + line;
						isInvalidLine = true;
					}
					if (line.Contains("uniform") && blockStartRegex.IsMatch(line))
					{
						isInUnsupportedUniformBlock = true;
						line = "\n// removed unsupported block: " + line;
						isInvalidLine = true;
					}
					else if (isInUnsupportedUniformBlock)
					{
						if (line.StartsWith("}"))
						{
							isInUnsupportedUniformBlock = false;
							continue;
						}

						if (!isInvalidLine)
						{
							line = line.Replace("UNITY_UNIFORM", "");
							line = "uniform " + line.TrimStart();
						}
					}

					line = replaceLayoutRegex.Replace(line, "");
					line = removeUpperCaseDefinesWithArg.Replace(line, "");
					
					if (line.Contains("GL_EXT_shader_texture_lod") || line.Contains("GL_EXT_shader_framebuffer_fetch") || line.TrimStart().StartsWith("inout "))
					{
						line = "// " + line;
						isInvalidLine = true;
					}

					// if (line.StartsWith("uniform")) line = line.Replace("uniform", "uniform highp");

					// if (line.StartsWith("attribute highp vec"))
					// 	line = "//" + line;
					line = line.Replace("in_NORMAL0", "normal");
					line = line.Replace("in_TANGENT0", "tangent");
					line = line.Replace("in_POSITION0", "position");
					line = line.Replace("in_TEXCOORD0", "uv");
					line = line.Replace("in_COLOR0", "color");

					// if (shader.type == ExtensionData.ShaderType.Fragment)
					// {
					// 	line = line.Replace("gl_FragData[0]", "gl_FragColor");
					// }
					// else if (shader.type == ExtensionData.ShaderType.Vertex)
					// {
					// 	if (line.Contains("vs_TEXCOORD0 ="))
					// 		line = "vs_TEXCOORD0 = vec4(uv, 0,0);";
					// }

					foundAnyText = true;
					res.AppendLine(line);
				}
			} while (line != null);

			var newCode = res.ToString();
			if (didHaveCode)
				shader.code = newCode;
			shader.uri = ExtensionData.Shader.GetUri(newCode);
		}
	}
}