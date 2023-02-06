using System;
using System.Collections.Generic;
using System.IO;
using JetBrains.Annotations;
using Needle.Engine.Core;
using Needle.Engine.Gltf.UnityGltf;
using Needle.Engine.Utils;
using Needle.Engine.Shaders;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Needle.Engine.Gltf
{
	[Serializable]
	public struct LightmapData
	{
		// json pointer
		public string pointer;
		public Type type;
		public int index;

		public enum Type
		{
			Lightmap = 0,
			Skybox = 1,
			Reflection = 2,
		}

		public static LightmapData GetForLightmap(int id)
		{
			return new LightmapData()
			{
				pointer = id.AsTexturePointer(),
				type = Type.Lightmap
			};
		}

		public static LightmapData GetForSkybox(int id)
		{
			return new LightmapData()
			{
				pointer = id.AsTexturePointer(),
				type = Type.Skybox
			};
		}

		public static LightmapData GetForCustomReflection(int id)
		{
			return new LightmapData()
			{
				pointer = id.AsTexturePointer(),
				type = Type.Reflection
			};
		}
	}

	/// <summary>
	/// Implement on extension
	/// </summary>
	public interface ILightmapExtension
	{
		void RegisterData(LightmapData lightmapData);
	}

	[UsedImplicitly]
	public class LightmapsExporter : GltfExtensionHandlerBase
	{
		private static ILightmapExtension Create(GltfExportContext context)
		{
			// this could check which exporter we're using and once gltfast has support for it
			// we return the gltfast extension version
			if (context.IsExportType(GltfExporterType.UnityGLTF))
				return new UnityGltf_NEEDLE_lightmaps(context);
			return null;
		}


		public override void OnAfterExport(GltfExportContext context)
		{
			base.OnAfterExport(context);

			if (context.Settings?.IsExtensionAllowed(UnityGltf_NEEDLE_lighting_settings.EXTENSION_NAME) == false)
			{
				return;
			}
			var allowSkyboxExport = context.Settings?.ExportSkybox ?? true;

			var settings = ObjectUtils.FindObjectOfType<ISkyboxExportSettingsProvider>();
			var textureSize = default(int);
			if (settings != null) textureSize = settings.SkyboxResolution;

			var ext = default(ILightmapExtension);
			AddLightmap(context, ref ext);

			if (allowSkyboxExport)
			{
				var format = settings != null && settings.HDR ? OutputFormat.EXR : OutputFormat.PNG;
				AddSkybox(context, textureSize, ref ext, format);
				AddCustomReflection(context, textureSize, ref ext);
			}

			if (ext == null) return;
			context.Bridge.AddExtension(UnityGltf_NEEDLE_lightmaps.EXTENSION_NAME, ext);
		}

		private static IEnumerable<Texture> EnumerateLightmaps()
		{
			var lm = LightmapSettings.lightmaps;
			foreach (var data in lm)
			{
				yield return data.lightmapColor;
			}
		}

		private static int lastExportId = -1;
		private static bool exportWithoutLightmaps = false;
		private static bool needReimportLightmaps = false;
		private static DateTime lastTimeLightmapExportDialogShowed = DateTime.MinValue;

		private static void AddLightmap(GltfExportContext context, ref ILightmapExtension ext)
		{
			if (Lightmapping.isRunning)
			{
				Debug.LogWarning("Lightmap baking is currently in process - exported lightmaps might be missing or incorrect");
			}
			if (lastExportId != context.Id)
			{
				needReimportLightmaps = false;
			}
			if (PlayerSettingsAccess.IsLightmapEncodingSetToNormalQuality())
			{
				exportWithoutLightmaps = false;
			}
			var i = 0;
			foreach (var tex in EnumerateLightmaps())
			{
				if (i == 0 && !PlayerSettingsAccess.IsLightmapEncodingSetToNormalQuality())
				{
					var isBuildingPlayer = BuildPipeline.isBuildingPlayer;
					if (isBuildingPlayer) continue;
					if (context.Id != lastExportId)
					{
						lastExportId = context.Id;
						var encodingName = PlayerSettingsAccess.GetLightmapEncodingSettingName();
						var shouldShowDialog = (DateTime.Now - lastTimeLightmapExportDialogShowed).TotalSeconds > 20;
						var message =
							$"Attempting to export lightmaps, but Lightmap Encoding is set to {encodingName} Quality but it should be Normal Quality! Lightmaps can not be exported with this setting.\n\nPlease open Edit > Project Settings > Player, select your current Build Target and set Lightmap Encoding to Normal Quality!";
						var res = !shouldShowDialog ? false : EditorUtility.DisplayDialog("Wrong Lightmap Encoding", message, "Abort Export", "Export without lightmaps");
						if (res)
						{
							SettingsService.OpenProjectSettings("Project/Player");
							throw new AbortExportException("Wrong Lightmap Encoding: " + encodingName + " Quality");
							// PlayerSettingsAccess.SetLightmapEncodingToNormalQuality();
							// exportWithoutLightmaps = false;
							// needReimportLightmaps = true;
						}
						else
						{
							exportWithoutLightmaps = true;
							Debug.LogError("<b>Wrong Lightmap Encoding</b>: " + message);
						}
						// throw new AbortExportException("Wrong Lightmap Encoding: " + encodingName + " Quality");
					}
				}
				if (exportWithoutLightmaps) continue;
				var index = i++;
				if (!tex)
				{
					Debug.LogWarning("Unity returned invalid lightmap at " + index);
					continue;
				}
				if (needReimportLightmaps)
				{
					AssetDatabase.ImportAsset(AssetDatabase.GetAssetPath(tex), ImportAssetOptions.ForceSynchronousImport);
				}
				tex.name = "Lightmap-" + index;
				var id = context.Bridge.AddTexture(tex);
				if (id < 0) return;
				var data = LightmapData.GetForLightmap(id);
				data.index = index;
				ext ??= Create(context);
				ext?.RegisterData(data);
			}
		}

		private static void AddSkybox(GltfExportContext context, int? textureSize, ref ILightmapExtension ext, OutputFormat format)
		{
			if (!RenderSettings.skybox) return;
			const int minTextureSize = 64;
			var hasTextureSizeDefined = textureSize != null && textureSize > 8;
			if (textureSize == null || textureSize <= 0)
			{
				var mat = RenderSettings.skybox;
				if (mat && mat.shader.name != "Skybox/Procedural")
				{
					textureSize = 0;
					foreach (var textures in mat.GetTexturePropertyNames())
					{
						var tex = mat.GetTexture(textures);
						if (tex && EditorAssetUtils.TryGetTextureImporterSettings(tex, out var settings))
						{
							// if the texture is only 20px we dont want to make it bigger
							var maxSize = Mathf.Min(tex.width, tex.height, settings.maxTextureSize);
							textureSize = Mathf.Max(textureSize.Value, maxSize);
						}
					}
				}
			}

			// clamp min size for compression and reflection to work (reflection needs 128 px at least)
			// but we dont want to export referenced glbs automatically with a big skybox 
			if (hasTextureSizeDefined)
			{
				textureSize = Mathf.Max(textureSize ?? 0, minTextureSize);
			}
			else
			{
				// We can not check for ExportContext only as the parent context since we have an ObjectExportContext when exporting via the context menu. We could add a flag to the GltfExportContext to check if it's the root
				var isRootExport = !(context.ParentContext is GltfExportContext);
				if (isRootExport)
				{
					textureSize = Mathf.Max(256, textureSize.GetValueOrDefault());
				}
				else
				{
					// TODO: https://github.com/needle-tools/needle-tiny-playground/issues/510
					textureSize = minTextureSize;
				}
			}

			if (textureSize > 1024)
			{
				Debug.LogWarning(
					$"<b>Exported skybox is {textureSize}!</b> This will result in a big output file ({Path.GetFileName(context.Path)}) - is this intentional?\nIf you are using a custom skybox texture you can adjust the max texture size for Needle Engine or you can add the {nameof(SkyboxExportSettings)} component to your scene",
					RenderSettings.skybox);
			}

			// check if is power of two
			if (textureSize > 0 && !Mathf.IsPowerOfTwo(textureSize.Value))
			{
				// make power of two
				textureSize = Mathf.NextPowerOfTwo(textureSize.Value);
				Debug.LogWarning("Skybox texture size is not a power of two! This will result in a blurry skybox - will export with next power of two: " +
				                 textureSize);
			}

			if (textureSize > 4096 && format == OutputFormat.EXR)
			{
				Debug.LogError("Skybox texture size is too big! Please reduce the texture size or use a smaller skybox texture! Clamping skybox size to 4096");
				textureSize = 4096;
			}

			var skybox = default(Texture);
			if (RenderSettings.skybox.HasProperty(Tex))
				skybox = RenderSettings.skybox.GetTexture(Tex);
			
			if (skybox) TextureUtils.ValidateCubemapSettings(skybox, TextureUtils.CubemapUsage.Skybox);

			using var exporter = new CubemapExporter(textureSize.GetValueOrDefault(minTextureSize), OutputFormat.EXR);
			// Dont flip y when baking, otherwise we might run into trouble when using pass through skybox export where the skybox is not flipped in the file and at runtime we flip (which would then be upside down)
			skybox = exporter.RenderSkyboxAndEnvironmentToEquirectTexture(false);

			if (!skybox) return;
			skybox.name = "Skybox";
			var id = context.Bridge.AddTexture(skybox);
			if (id < 0) return;
			ext ??= Create(context);
			var data = LightmapData.GetForSkybox(id);
			ext.RegisterData(data);

			// exporter.WriteTextureToDisk(skybox, "Assets/Skybox");
			// AssetDatabase.Refresh();
		}

		private static void AddCustomReflection(GltfExportContext context, int textureSize, ref ILightmapExtension ext)
		{
			if (RenderSettings.defaultReflectionMode != DefaultReflectionMode.Custom) return;
			if (textureSize < 8) textureSize = 256;

#if UNITY_2022_1_OR_NEWER
			var custom = RenderSettings.customReflectionTexture as Cubemap;
#else
			var custom = RenderSettings.customReflection as Cubemap;
#endif
			if (!custom) return;

			using var exporter = new CubemapExporter(textureSize, OutputFormat.EXR);
			var customReflection = exporter.ConvertCubemapToEquirectTexture(custom, false);
			if (customReflection)
			{
				TextureUtils.ValidateCubemapSettings(customReflection, TextureUtils.CubemapUsage.CustomReflection);
				custom.name = "CustomReflection";
				var id = context.Bridge.AddTexture(customReflection);
				if (id < 0) return;
				customReflection.hideFlags = HideFlags.None;
				ext ??= Create(context);
				ext.RegisterData(LightmapData.GetForCustomReflection(id));
				//exporter.WriteTextureToDisk(customReflection, "Assets/Reflection");
			}
		}

		private static readonly int Tex = Shader.PropertyToID("_Tex");
	}
}