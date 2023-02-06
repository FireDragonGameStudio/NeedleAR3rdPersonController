using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class SpriteResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result)
		{
			try
			{
				if (value is Sprite sprite && sprite)
				{
					if (resolver.ExportContext != null)
					{
						// TODO: look into emitting the sprite with GLTF as a texture
						if (TextureExportUtils.TryExportSprite(resolver.ExportContext.Project.AssetsDirectory, sprite, out var file))
						{
							result = "\"" + file + "\"";
							return true;
						}
					}

				}

				if (resolver.CurrentField?.Owner is RawImage)
				{
					if (value is Texture2D tex)
					{
						if (resolver.ExportContext != null)
						{
							var outputName = tex.name + ".png";
							var outputPath = resolver.ExportContext.Project.AssetsDirectory + "/" + outputName;
							if (!File.Exists(outputPath))
							{
								var assetPath = AssetDatabase.GetAssetPath(tex);
								// var tex2 = new RenderTexture(tex.width, tex.height, 0);
								// Graphics.Blit(tex, tex2);
								// var spriteBytes = tex.EncodeToPNG();
								// File.WriteAllBytes(outputPath, spriteBytes);
								File.Copy(assetPath, outputPath);
							}
							result = "\"assets/" + outputName + "\"";
							return true;
						}
					}
				}
			}
			catch (Exception e)
			{
				Debug.LogException(e);
			}

			result = null;
			return false;
		}
	}

	public static class TextureExportUtils
	{
		public static bool TryExportSprite(string directory, Sprite sprite, out string exportedFileName)
		{
			var name = sprite.name + ".png";
			exportedFileName = "assets/" + name;
			var outputPath = directory + "/" + name;

			if (File.Exists(outputPath))
				return true;

			// if (AssetDatabase.IsMainAsset(sprite)) 
			AssetDatabase.GetAssetPath(sprite);
			// else assetPath = AssetDatabase.LoadMainAssetAtPath()
			var importer = AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(sprite)) as TextureImporter;
			if (importer)
			{
				if (!importer.isReadable)
				{
					importer.isReadable = true;
					importer.SaveAndReimport();
					AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
				}
			}

			// var instance = Object.Instantiate(sprite);
			// File.Copy(assetPath, outputPath);
			var tex = sprite.texture;
			if (importer && importer.textureCompression != TextureImporterCompression.Uncompressed)
			{
				if (tex.isReadable)
				{
					// var format = GraphicsFormatUtility.GetTextureFormat(tex.graphicsFormat);
					var texCopy = new Texture2D(tex.width, tex.height);//, format, false);
					texCopy.SetPixels(tex.GetPixels());
					// Graphics.CopyTexture(tex, 0, 0, texCopy, 0, 0);
					tex = texCopy;
				}
			}
			
			if (tex.isReadable)
			{
				var spriteBytes = tex.EncodeToPNG();
				File.WriteAllBytes(outputPath, spriteBytes);
			}
			else
			{
				Debug.LogWarning("Sprite is not readable: " + sprite, sprite);
				exportedFileName = "name:" + sprite.name;
				return true;
			}

			// UnityEditorInternal.InternalEditorUtility.SaveToSerializedFileAndForget(new []{instance},outputPath, true);
			// Object.DestroyImmediate(instance);
			return true;
		}
	}
}