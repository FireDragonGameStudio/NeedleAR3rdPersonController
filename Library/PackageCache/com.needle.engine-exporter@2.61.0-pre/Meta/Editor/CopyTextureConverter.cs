using System;
using System.IO;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal class CopyTextureConverter : JsonConverter<Texture>
	{
		public override bool CanRead => false;
		
		public override void WriteJson(JsonWriter writer, Texture value, JsonSerializer serializer)
		{
			if (!value)
			{
				writer.WriteValue("");
				return;
			}
			
			var path = Path.GetFullPath(AssetDatabase.GetAssetPath(value)).Replace("\\", "/");
                
			// writer.WriteValue(path); // absolute path
			// relative path to where the file is copied to. Ideally this comes from the field and attributes itself,
			// but that's surprisingly hard to access from within a Converter
			writer.WriteValue("include/" + Path.GetFileName(path)); 
		}
		
		public override Texture ReadJson(JsonReader reader, Type objectType, Texture existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			return null;
		}
	}
}