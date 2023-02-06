using System;
using System.Collections.Generic;
using System.Linq;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.U2D;

namespace Needle.Engine.Gltf.Spritesheets
{
	[Serializable]
	public class SpriteSheet
	{
		private static bool isSerializing = false;
		
		public static bool TryCreate(object owner, Sprite sprite, GltfExportContext context, out JToken res)
		{
			// Make sure we dont run into circular serialization
			if(isSerializing)
			{
				res = default;
				return false;
			}
			var assetPath = AssetDatabase.GetAssetPath(sprite);
			var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
			if (importer?.spritesheet != null && importer.spritesheet.Length > 1 && importer.spriteImportMode == SpriteImportMode.Multiple)
			{
				// this might need to be added to persistent assets extension
				var sheet = new SpriteSheet();
				var sprites = AssetDatabase.LoadAllAssetRepresentationsAtPath(assetPath);
				// instead of taking the assigned sprite we always use the first sprite
				// because the UVs get baked into the mesh affecting the index when animating
				// this is maybe not optimal - alternatively we could also just build a new mesh per sprite
				// and swap the mesh instead of offsetting the texture coords
				sheet.sprite = sprites.FirstOrDefault(s => s as Sprite) as Sprite;
				for (var index = 0; index < importer.spritesheet.Length; index++)
				{
					var meta = importer.spritesheet[index];
					var spr = sprites.FirstOrDefault(s => s.name == meta.name) as Sprite;
					if (!spr)
					{
						continue;
					}
					var slice = new Slice();
					slice.name = meta.name;
					slice.offset = new Vector2(spr.rect.x / spr.texture.width, 1 - spr.rect.yMax / sprite.texture.height);
					slice.size = new Vector2(spr.rect.size.x / spr.texture.width, spr.rect.size.y / spr.texture.height);
					sheet.slices.Add(slice);
					if (meta.name == sprite.name)
						sheet.index = index;	
				}
				try
				{
					// TODO: add to persistent asset extension and return pointer
					isSerializing = true;
					res = JObject.Parse(context.Serializer.Serialize(sheet));
					return true;
				}
				finally
				{
					isSerializing = false;
				}
			}
			res = null;
			return false;
		}

		public class Slice
		{
			public string name;
			public Vector2 offset;
			public Vector2 size;
		}

		public Sprite sprite;
		// which index is active
		public int index = 0;
		public List<Slice> slices = new List<Slice>();
	}
}