#nullable enable

using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

namespace Needle.Engine.Shaders
{
	public enum OutputFormat
	{
		PNG = 0,
		JPEG = 1,
		EXR = 2
	}

	public class CubemapExporter : IDisposable
	{
		// both of these can only be changed if no output rt has been created, otherwise we need to resize/dispose it
		public int EquirectWidth => equirectWidth;
		public OutputFormat Format => format;

		private readonly int equirectWidth;
		private readonly OutputFormat format;

		private static UnityEngine.Shader? renderCubemapShader;

		private Material? _renderCubemap;

		private Material renderCubemap
		{
			get
			{
				if (_renderCubemap && _renderCubemap != null) return _renderCubemap;

				// TODO this needs Unit tests on URP/BiRP
				// This seems to work correct on BiRP
				if (!GraphicsSettings.currentRenderPipeline)
				{
					if (!renderCubemapShader)
					{
						var path = AssetDatabase.GUIDToAssetPath("f3e6b109b13fe2142b1a109ed109a3c1");
						renderCubemapShader = AssetDatabase.LoadAssetAtPath<UnityEngine.Shader>(path);
						Debug.Assert(renderCubemapShader, "Missing cubemap export shader");
					}
					_renderCubemap = new Material(renderCubemapShader);
				}
				else
				{
					// This seems to work  on URP
					_renderCubemap = new Material(UnityEngine.Shader.Find("Skybox/Cubemap"));
				}
				Debug.Assert(_renderCubemap);
				return _renderCubemap!;
			}
		}

		private RenderTexture? _outputRT;

		private RenderTexture outputRT
		{
			get
			{
				if (!_outputRT)
				{
					EnsureRT(ref _outputRT);
					Debug.Assert(_outputRT, "Failed creating output render texture");
				}
				return _outputRT!;
			}
		}

		public CubemapExporter(int equirectWidth, OutputFormat format)
		{
			this.equirectWidth = equirectWidth;
			this.format = format;
		}

		public void Dispose()
		{
			if (_outputRT && _outputRT!.IsCreated())
			{
				_outputRT.Release();
				_outputRT = null;
			}
		}

		private readonly Vector3[] rotationPerFace = new Vector3[]
		{
			new Vector3(0, -90, 0),
			new Vector3(0, 90, 0),
			new Vector3(90, 180, 0),
			new Vector3(-90, 180, 0),
			new Vector3(0, 180, 0),
			new Vector3(0, 0, 0),
		};

		public Texture2D? RenderSkyboxAndEnvironmentToEquirectTexture(bool flipY = false, bool renderEnvironmentLayer = true)
		{
			RenderTexture? cubemap = default;
			Camera? camera = default;

			try
			{
				//// Old approach - seems to randomly produce errors
				// if (!RenderSettings.skybox) return null;
				// var rt = MaterialToCubemapRenderTexture(RenderSettings.skybox, outputRT);
				// return RenderTextureToEquirectTexture(rt, flipY);

				//// New approach - spin up a new cam and render that - will by default just render the skybox.
				//// also, if there's an "Environment" layer defined, we can render that as well.
				camera = new GameObject("Temp::RenderSkybox").AddComponent<Camera>();
				camera.hideFlags = HideFlags.HideAndDontSave;
				if (renderEnvironmentLayer)
				{
					var envLayer = LayerMask.GetMask("Environment");
					camera.cullingMask = Mathf.Max(envLayer, 0);
				}
				else camera.cullingMask = 0;
				camera.stereoTargetEye = StereoTargetEyeMask.None;
				camera.allowHDR = true;
				cubemap = new RenderTexture(equirectWidth, equirectWidth, 24, DefaultFormat.HDR);
				cubemap.dimension = TextureDimension.Cube;
				DynamicGI.UpdateEnvironment();
				camera.RenderToCubemap(cubemap);

				return RenderTextureToEquirectTexture(cubemap, flipY);
			}
			finally
			{
				if (camera && camera != null)
					Object.DestroyImmediate(camera.gameObject);
				if (cubemap)
					Object.DestroyImmediate(cubemap);
			}
		}

		private Material? _convertCubemapToEquirect;

		private Material ConvertCubemapToEquirect
		{
			get
			{
				if (!_convertCubemapToEquirect)
				{
					var shader = Shader.Find("Skybox/Cubemap");
					_convertCubemapToEquirect = new Material(shader);
				}
				return _convertCubemapToEquirect!;
			}
		}

		private static readonly int cubemapMainTextureProperty = UnityEngine.Shader.PropertyToID("_Tex");

		public Texture2D? ConvertCubemapToEquirectTexture(Cubemap map, bool flipY = false)
		{
			if (!map) return null;
			var skybox = RenderSettings.skybox;
			try
			{
				ConvertCubemapToEquirect.mainTexture = map;
				ConvertCubemapToEquirect.SetTexture(cubemapMainTextureProperty, map);
				RenderSettings.skybox = ConvertCubemapToEquirect;
				return RenderSkyboxAndEnvironmentToEquirectTexture(flipY, false);
			}
			finally
			{
				RenderSettings.skybox = skybox;
			}
		}

		private Texture2D? RenderTextureToEquirectTexture(RenderTexture? rt, bool flipY = false)
		{
			if (rt != null)
			{
				var active = RenderTexture.active;
				var equirect = new RenderTexture(equirectWidth, equirectWidth / 2, 0, GetRenderTextureFormat(format));
				equirect.useMipMap = false;
				equirect.wrapMode = TextureWrapMode.Clamp;
				CubemapRenderTextureToEquirect(rt, equirect);

				// apply 90° rotation around Y
				// optionally flip vertically before exporting
				var mat = new Material(Shader.Find("Hidden/Needle/CubemapAlignment"));
				equirect.wrapMode = TextureWrapMode.Repeat;
				mat.SetTexture("_MainTex", equirect);
				mat.SetFloat("_ShiftX", 0.25f);
				mat.SetFloat("_FlipY", flipY ? 1 : 0);
				var temp = new RenderTexture(equirect.descriptor);
				Graphics.Blit(equirect, temp, mat);
				equirect.Release();
				equirect = temp;

				var texture = RenderTextureToTexture(equirect);
				if (texture != null)
				{
					texture.wrapMode = TextureWrapMode.Clamp;
				}
				RenderTexture.active = active;
				equirect.Release();
				return texture;
			}
			return null;
		}

		public void WriteTextureToDisk(Texture2D texture, string pathWithoutExtension)
		{
			byte[] bytes;
			switch (format)
			{
				case OutputFormat.PNG:
					bytes = texture.EncodeToPNG();
					break;
				case OutputFormat.JPEG:
					bytes = texture.EncodeToJPG(95);
					break;
				case OutputFormat.EXR:
					bytes = texture.EncodeToEXR(Texture2D.EXRFlags.CompressZIP);
					break;
				default:
					throw new ArgumentOutOfRangeException();
			}
			File.WriteAllBytes(pathWithoutExtension + GetExtension(format), bytes);
		}

		private void BlitSingleCubemapFace(RenderTexture destination, Material material, int face)
		{
			Graphics.SetRenderTarget(destination, 0, (CubemapFace)face, 0);

			GL.LoadIdentity();
			var rot = Quaternion.Euler(rotationPerFace[face]) * Quaternion.Euler(0, -90, 0);
			GL.modelview = Matrix4x4.TRS(Vector3.zero, rot, new Vector3(-1, 1, 1));
			var proj = GL.GetGPUProjectionMatrix(Matrix4x4.Perspective(90, 1, 0.01f, 100), true);
			GL.LoadProjectionMatrix(proj);

			material.SetPass(0);

			Graphics.DrawMeshNow(sphereMeshForCubemapRendering, Matrix4x4.Scale(Vector3.one * 10));
			GL.Flush();
		}

		public static void CubemapRenderTextureToEquirect(RenderTexture cubeRt, RenderTexture equirect)
		{
			cubeRt.ConvertToEquirect(equirect, Camera.MonoOrStereoscopicEye.Mono);
		}

		public Texture2D? RenderTextureToTexture(RenderTexture renderTexture)
		{
			var active = RenderTexture.active;
			RenderTexture.active = renderTexture;
			try
			{
				var defaultFormat = GetRenderTextureFormat(format);
				var graphicsFormat = SystemInfo.GetGraphicsFormat(defaultFormat);
				if (!SystemInfo.IsFormatSupported(graphicsFormat, FormatUsage.Sample))
				{					
					Debug.LogWarning("<b>Can not export HDR cubemap on current Build Target platform</b>: Format " + graphicsFormat + " is not supported on this platform. Try switching to another Build Platform. You are currently on " + EditorUserBuildSettings.activeBuildTarget);
					graphicsFormat = GraphicsFormatUtility.GetGraphicsFormat(RenderTextureFormat.Default, RenderTextureReadWrite.Linear);
				}
				var res = new Texture2D(renderTexture.width, renderTexture.height, graphicsFormat,
					TextureCreationFlags.None);
				res.ReadPixels(new Rect(0, 0, res.width, res.height), 0, 0);
				res.Apply();
				return res;
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}
			finally
			{
				RenderTexture.active = active;
			}
			
			return null;
		}

		public static string GetExtension(OutputFormat format)
		{
			switch (format)
			{
				case OutputFormat.PNG: return ".png";
				case OutputFormat.JPEG: return ".jpeg";
				case OutputFormat.EXR: return ".exr";
				default:
					throw new ArgumentOutOfRangeException(nameof(format), format, null);
			}
		}

		private Mesh? sphereMeshForCubemapRendering;

		[Obsolete("use ConvertCubemapToEquirectTexture")]
		public RenderTexture? MaterialToCubemapRenderTexture(Material? mat, RenderTexture outputRt)
		{
			if (!mat || mat == null) return null;
			if (!outputRt) throw new ArgumentNullException(nameof(outputRt));

			if (!sphereMeshForCubemapRendering)
			{
				sphereMeshForCubemapRendering =
					AssetDatabase.LoadAssetAtPath<Mesh>(
						AssetDatabase.GUIDToAssetPath("7fbe2f56af2e6684abe4810a5b480eb8"));
				if (!sphereMeshForCubemapRendering) Debug.LogError("SphereMesh not found!");
			}

			var currentActiveRT = RenderTexture.active;
			var currentWrite = GL.sRGBWrite;

			GL.sRGBWrite = true;
			GL.PushMatrix();
			for (var i = 0; i < 6; i++)
				BlitSingleCubemapFace(outputRt, mat, i);
			GL.PopMatrix();

			GL.sRGBWrite = currentWrite;
			RenderTexture.active = currentActiveRT;

			return outputRt;
		}

		[Obsolete("use ConvertCubemapToEquirectTexture")]
		public RenderTexture? CubemapToRenderTexture(Cubemap cubemap, RenderTexture renderTexture)
		{
			if (!cubemap) throw new ArgumentNullException(nameof(cubemap));
			if (!renderTexture) throw new ArgumentNullException(nameof(renderTexture));
			renderCubemap.SetTexture(cubemapMainTextureProperty, cubemap);
			return MaterialToCubemapRenderTexture(renderCubemap, renderTexture);
		}

		public static DefaultFormat GetRenderTextureFormat(OutputFormat format)
		{
			// TODO: default format is dangerous because it may fail if we are on e.g. Android platform
			return format == OutputFormat.EXR ? DefaultFormat.HDR : DefaultFormat.LDR;
		}

		public void EnsureRT(ref RenderTexture? rt)
		{
			var width = Mathf.Clamp(equirectWidth, 4, 8192);
			var actualFaceSize = Mathf.ClosestPowerOfTwo(width);
			if (!rt || rt == null || rt.width != actualFaceSize || rt.dimension != TextureDimension.Cube ||
			    rt.volumeDepth != 6 || !rt.IsCreated())
			{
				if (rt && rt!.IsCreated())
					rt.Release();
				rt = new RenderTexture(actualFaceSize, actualFaceSize, 0, GetRenderTextureFormat(format));
				rt.hideFlags = HideFlags.DontSaveInEditor;
				rt.volumeDepth = 6;
				rt.dimension = TextureDimension.Cube;
				rt.Create();
			}
		}
	}
}