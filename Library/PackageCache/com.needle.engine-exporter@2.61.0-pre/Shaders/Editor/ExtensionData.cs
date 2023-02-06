using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Needle.Engine.Shaders
{
	[Serializable]
	public class ExtensionData
	{
		public List<Program> programs = new List<Program>();
		public List<Shader> shaders = new List<Shader>();
		public List<Technique> techniques =new List<Technique>();

		public void Clear()
		{
			programs.Clear();
			shaders.Clear();
			techniques.Clear();
		}

		[Serializable]
		public class Program
		{
			public int vertexShader;
			public int fragmentShader;
			public int id;
		}

		public enum ShaderType
		{
			Fragment = 35632,
			Vertex = 35633,
		}

		[Serializable]
		public class Shader
		{
			public string name = "Shader";
			public ShaderType type;
			const string DataUriBase64 = "data:text/plain;base64,";
			
			// can be a data-uri, or file ref to .glsl
			[Multiline]
			public string uri;
			// public int bufferView; // optional

			[Multiline(100), NonSerialized]
			public string code;
			public int id;
			
			// not part of the spec, used temporarily here
			public string filePath;

			internal static string GetUri(string code)
			{
				return Convert.ToBase64String(Encoding.UTF8.GetBytes(code));
			}
			internal static string GetCode(string uri)
			{
				return Encoding.UTF8.GetString(Convert.FromBase64String(uri));
			}
		}

		// ReSharper disable InconsistentNaming
		// ReSharper disable IdentifierTypo
        
		public enum UniformSemantic
		{
			NONE,
			LOCAL, // FLOAT_MAT4	Transforms from the node's coordinate system to its parent's. This is the node's matrix property (or derived matrix from translation, rotation, and scale properties).
			MODEL, //	FLOAT_MAT4	Transforms from model to world coordinates using the transform's node and all of its ancestors.
			VIEW, //	FLOAT_MAT4	Transforms from world to view coordinates using the active camera node.
			PROJECTION, //	FLOAT_MAT4	Transforms from view to clip coordinates using the active camera node.
			MODELVIEW, //	FLOAT_MAT4	Combined MODEL and VIEW.
			MODELVIEWPROJECTION, //	FLOAT_MAT4	Combined MODEL, VIEW, and PROJECTION.
			MODELINVERSE, //	FLOAT_MAT4	Inverse of MODEL.
			VIEWINVERSE, //	FLOAT_MAT4	Inverse of VIEW.
			PROJECTIONINVERSE, //	FLOAT_MAT4	Inverse of PROJECTION.
			MODELVIEWINVERSE, //	FLOAT_MAT4	Inverse of MODELVIEW.
			MODELVIEWPROJECTIONINVERSE, //	FLOAT_MAT4	Inverse of MODELVIEWPROJECTION.
			MODELINVERSETRANSPOSE, //	FLOAT_MAT3	The inverse-transpose of MODEL without the translation. This transforms normals in model coordinates to world coordinates.
			MODELVIEWINVERSETRANSPOSE, //	FLOAT_MAT3	The inverse-transpose of MODELVIEW without the translation. This transforms normals in model coordinates to eye coordinates.
			VIEWPORT, //	FLOAT_VEC4	The viewport's x, y, width, and height properties stored in the x, y, z, and w components, respectively. For example, this is used to scale window coordinates to [0, 1]: vec2 v = gl_FragCoord.xy / viewport.zw;
			JOINTMATRIX, //	FLOAT_MAT4[]	Array parameter; its length (uniform.count) must be greater than or equal to the length of jointNames array of a skin being used. Each element transforms mesh coordinates for a particular joint for skinning and animation.
			ALPHACUTOFF, //	FLOAT	The value of the material's alphaCutoff property.
		}

		public enum UniformType
		{
			INT = 5124,
			FLOAT = 5126,
			FLOAT_VEC2 = 35664,
			FLOAT_VEC3 = 35665,
			FLOAT_VEC4 = 35666,
			INT_VEC2 = 35667,
			INT_VEC3 = 35668,
			INT_VEC4 = 35669,
			BOOL = 35670, // exported as int
			BOOL_VEC2 = 35671,
			BOOL_VEC3 = 35672,
			BOOL_VEC4 = 35673,
			FLOAT_MAT2 = 35674, // exported as vec2[2]
			FLOAT_MAT3 = 35675, // exported as vec3[3]
			FLOAT_MAT4 = 35676, // exported as vec4[4]
			SAMPLER_2D = 35678,
			SAMPLER_3D = 35680, // added, not in the proposed extension
			SAMPLER_CUBE = 35681, // added, not in the proposed extension
			UNKNOWN = 0,
		}

		public enum AttributeSemantic
		{
			POSITION,
			NORMAL,
			TEXCOORD_0,
			TEXCOORD_1,
			COLOR_0,
			COLOR_1,
			JOINT,
			WEIGHT,
			UNKNOWN,
		}
        
		// ReSharper restore IdentifierTypo
		// ReSharper restore InconsistentNaming
        
		// see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl#attribute
		[Serializable]
		public class ShaderAttribute
		{
			public string semantic; // from AttributeSemantic

			public static AttributeSemantic SemanticFromName(string s)
			{
				foreach(AttributeSemantic semantic in Enum.GetValues(typeof(AttributeSemantic)))
					if (s.Contains(semantic.ToString().Replace("_", "")))
						return semantic;
				return AttributeSemantic.UNKNOWN;
			}
		}
        
		// see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl#uniform
		[Serializable]
		public class ShaderUniform
		{
			public string name;
			public UniformType type;
			public string semantic; // from UniformSemantic
			public int count;
			public int node;

			public static UniformType TypeFromTypeString(string s)
			{
				switch (s)
				{
					case "uint":
					case "int": 
						return UniformType.INT;
					
					case "ivec2":
					case "vec2u": 
						return UniformType.INT_VEC2;
					
					case "ivec3": 
					case "vec3u":
						return UniformType.INT_VEC3;
					
					case "ivec4":
					case "vec4u": 
						return UniformType.INT_VEC4;
                    
					case "float": return UniformType.FLOAT;
					case "vec2": return UniformType.FLOAT_VEC2;
					case "vec3": return UniformType.FLOAT_VEC3;
					case "vec4": return UniformType.FLOAT_VEC4;
                    
					case "bvec2": return UniformType.BOOL_VEC2;
					case "bvec3": return UniformType.BOOL_VEC3;
					case "bvec4": return UniformType.BOOL_VEC4;
                    
					case "sampler2D": return UniformType.SAMPLER_2D;
					case "sampler3D": return UniformType.SAMPLER_3D;
					case "samplerCube": return UniformType.SAMPLER_CUBE;
				}

				Debug.LogError("Can't convert type, please add explicit conversion: " + s);
				return UniformType.UNKNOWN;
			}

			public static string SemanticFromName(string s)
			{
				if (s.EndsWith("_ObjectToWorld"))
					return UniformSemantic.MODEL.ToString();
				if (s.EndsWith("_MatrixVP"))
					return "_VIEWPROJECTION";
                
				// Debug.Log("semantic from name: " + s);
				return null;
			}
		}
        
		[Serializable]
		public class Technique
		{
			public int program;
			public Dictionary<string, ShaderAttribute> attributes;
			public Dictionary<string, ShaderUniform> uniforms;
			public string[] defines;
		}
	}
}