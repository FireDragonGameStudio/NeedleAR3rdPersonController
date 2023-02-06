using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;
using UnityEngine.Rendering;

namespace Needle.Engine.Shaders
{
	public struct ShaderPropertyInfo
	{
		public string Name;
		public object Value;
		public ShaderUtil.ShaderPropertyType Type;
	}

	public struct TexturePropertyInfo
	{
		public Texture Texture;
		public string SamplerStateName;
		public Vector4 SamplerState;
	}

	public static class ShaderPropertyExtensions
	{
		public static IEnumerable<ShaderPropertyInfo> EnumerateProperties(Material mat,
			MaterialPropertyBlock block = null)
		{
			var shader = mat.shader;
			var propertyCount = ShaderUtil.GetPropertyCount(shader);
			var shaderPath = AssetDatabase.GetAssetPath(shader);
			var importer = AssetImporter.GetAtPath(shaderPath);
			var hasBlock = block != null && !block.isEmpty;
			var foundCullingProperty = false;

			for (var i = 0; i < propertyCount; i++)
			{
				var name = ShaderUtil.GetPropertyName(shader, i);
				var type = ShaderUtil.GetPropertyType(shader, i);

				switch (name)
				{
					case "_Cull":
					case "__cull":
						foundCullingProperty = true;
						break;
				}

				switch (type)
				{
					case ShaderUtil.ShaderPropertyType.Color:
						Color col;
						if (hasBlock)
						{
							col = block.GetColor(name);
							if (col == default) col = mat.GetColor(name);
						}
						else col = mat.GetColor(name);
						yield return new ShaderPropertyInfo() { Name = name, Type = type, Value = col };
						break;
					case ShaderUtil.ShaderPropertyType.Vector:
						Vector4 vec;
						if (!block?.isEmpty ?? false)
						{
							vec = block.GetVector(name);
							if (vec == default) vec = mat.GetVector(name);
						}
						else vec = mat.GetVector(name);
						yield return new ShaderPropertyInfo() { Name = name, Type = type, Value = vec };
						break;
					case ShaderUtil.ShaderPropertyType.Range:
					case ShaderUtil.ShaderPropertyType.Float:
						float val;
						if (hasBlock)
						{
							val = block.GetFloat(name);
							if (Math.Abs(val - 0) < float.Epsilon) val = mat.GetFloat(name);
						}
						else val = mat.GetFloat(name);
						yield return new ShaderPropertyInfo() { Name = name, Type = type, Value = val };
						break;
					case ShaderUtil.ShaderPropertyType.TexEnv:
						var tex = !hasBlock ? mat.GetTexture(name) : block.GetTexture(name);
						if (!tex)
						{
							tex = TryGetDefaultTexture(importer, shader, name);
						}
						if (tex)
						{
							var samplerStateName = name + "_ST";
							var samplerState = mat.GetVector(samplerStateName);
							yield return new ShaderPropertyInfo()
							{
								Name = name, Type = type, Value = new TexturePropertyInfo()
								{
									Texture = tex,
									SamplerStateName = samplerStateName,
									SamplerState = samplerState
								}
							};
							// try
							// {
							// 	// var path = AssetDatabase.GetAssetPath(tex);
							// 	// var contentHash = tex.imageContentsHash;
							// 	// var assetName = contentHash; //tex.GetId();
							// 	// var dir = context.Project.AssetsDirectory;
							// 	// var newPath = $@"{dir}/{assetName}.jpg";
							// 	// File.Copy(path, newPath, true);
							// 	// var relPath = new Uri(context.Project.ProjectDirectory + "/", UriKind.Absolute)
							// 	// 	.MakeRelativeUri(new Uri(newPath, UriKind.Absolute));
							//
							// 	// writer.Write($"{name} : \"{tex.GetId()}\",");
							//
							// 	// samplerState.y *= -1;
							// 	// samplerState.w += 1;
							// 	// Debug.Log(samplerStateName + ": " + samplerState);
							// 	// writer.Write($"{samplerStateName} :new THREE.Vector4{samplerState},");
							// }
							// catch (ArgumentException ex)
							// {
							// 	Debug.LogException(ex);
							// }
						}
						else
						{
							// writer.Write($"{name} : \"{relPath}\",");
						}
						break;
					default:
						throw new ArgumentOutOfRangeException();
				}
			}

			// HACK: I hope we can remove this at some point but currently there's no API to really get the cull mode... :(
			if (!foundCullingProperty)
			{
				// TODO: export as https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#double-sided
				var path = AssetDatabase.GetAssetPath(shader);
				if (path.EndsWith(".shadergraph"))
				{
					var text = File.ReadAllText(path);
					if (text.Contains("\"m_TwoSided\": true") || text.Contains("\"m_RenderFace\": 0"))
					{
						yield return new ShaderPropertyInfo()
						{
							Name = "_Cull",
							Type = ShaderUtil.ShaderPropertyType.Float,
							Value = (int)CullMode.Off
						};
					}
					else if (text.Contains("\"m_RenderFace\": 1"))
					{
						yield return new ShaderPropertyInfo()
						{
							Name = "_Cull",
							Type = ShaderUtil.ShaderPropertyType.Float,
							Value = (int)CullMode.Front
						};
					}
					else
					{
						yield return new ShaderPropertyInfo()
						{
							Name = "_Cull",
							Type = ShaderUtil.ShaderPropertyType.Float,
							Value = (int)CullMode.Back
						};
					}
				}
			}
		}

		private static MethodInfo getShaderDefaultTextureMethod;
		private static bool getShaderDefaultTextureMethod_Reflected;

		private static Texture TryGetDefaultTexture(AssetImporter importer, UnityEngine.Shader shader, string propertyName)
		{
			if (importer is ShaderImporter si) return si.GetDefaultTexture(propertyName);
			if (importer is ScriptedImporter scripted)
			{
				// Debug.Log(scripted.assetPath);
				// TODO ShaderGraph
			}
			try
			{
				if (getShaderDefaultTextureMethod_Reflected == false)
				{
					getShaderDefaultTextureMethod_Reflected = true;
					getShaderDefaultTextureMethod =
						typeof(EditorMaterialUtility).GetMethod("GetShaderDefaultTexture", BindingFlags.Static | BindingFlags.NonPublic);
				}
				var tex = getShaderDefaultTextureMethod?.Invoke(null, new object[] { shader, propertyName }) as Texture;
				if (tex) return tex;
			}
			catch (Exception ex)
			{
				Debug.LogException(ex);
			}

			if (importer.assetPath.EndsWith(".shadergraph"))
			{
				if (propertyName.IndexOf("normal", StringComparison.OrdinalIgnoreCase) >= 0)
					return Texture2D.normalTexture;
				return Texture2D.whiteTexture;
				// var graphData = File.ReadAllText(importer.assetPath);
				// var shaderGraph = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(importer.assetPath);
			}

			return null;
		}
	}
}