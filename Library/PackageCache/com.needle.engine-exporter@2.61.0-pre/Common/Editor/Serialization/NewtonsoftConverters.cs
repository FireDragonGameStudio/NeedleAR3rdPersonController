using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	public class NeedleConverter : Attribute
	{
		private static List<JsonConverter> _converters;
		public static List<JsonConverter> GetAll()
		{
			if (_converters != null) return _converters;
			_converters = new List<JsonConverter>();
			foreach (var conv in TypeCache.GetTypesDerivedFrom<JsonConverter>())
			{
				if (conv.IsAbstract || conv.IsInterface) continue;
				if (conv.GetCustomAttribute<NeedleConverter>() == null) continue;
				var instance = Activator.CreateInstance(conv) as JsonConverter;
				_converters.Add(instance);
			}
			return _converters;
		}
	}



	[NeedleConverter]
	public class ColorConverter : JsonConverter<Color>
	{
		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Color value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.r));
			writer.WriteValue(value.r);
			writer.WritePropertyName(nameof(value.g));
			writer.WriteValue(value.g);
			writer.WritePropertyName(nameof(value.b));
			writer.WriteValue(value.b);
			writer.WritePropertyName(nameof(value.a));
			writer.WriteValue(value.a);
			writer.WriteEndObject();
		}

		public override Color ReadJson(JsonReader reader, Type objectType, Color existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}

	[NeedleConverter]
	public class Vec2Converter : JsonConverter<Vector2>
	{
		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Vector2 value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.x));
			writer.WriteValue(value.x);
			writer.WritePropertyName(nameof(value.y));
			writer.WriteValue(value.y);
			writer.WriteEndObject();
		}

		public override Vector2 ReadJson(JsonReader reader, Type objectType, Vector2 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}

	[NeedleConverter]
	public class Vec3Converter : JsonConverter<Vector3>
	{
		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Vector3 value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.x));
			writer.WriteValue(value.x);
			writer.WritePropertyName(nameof(value.y));
			writer.WriteValue(value.y);
			writer.WritePropertyName(nameof(value.z));
			writer.WriteValue(value.z);
			writer.WriteEndObject();
		}

		public override Vector3 ReadJson(JsonReader reader, Type objectType, Vector3 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}

	[NeedleConverter]
	public class Vec4Converter : JsonConverter<Vector4>
	{
		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Vector4 value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.x));
			writer.WriteValue(value.x);
			writer.WritePropertyName(nameof(value.y));
			writer.WriteValue(value.y);
			writer.WritePropertyName(nameof(value.z));
			writer.WriteValue(value.z);
			writer.WritePropertyName(nameof(value.w));
			writer.WriteValue(value.w);
			writer.WriteEndObject();
		}

		public override Vector4 ReadJson(JsonReader reader, Type objectType, Vector4 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}

	[NeedleConverter]
	public class QuaternionConverter : JsonConverter<Quaternion>
	{
		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Quaternion value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.x));
			writer.WriteValue(value.x);
			writer.WritePropertyName(nameof(value.y));
			writer.WriteValue(value.y);
			writer.WritePropertyName(nameof(value.z));
			writer.WriteValue(value.z);
			writer.WritePropertyName(nameof(value.w));
			writer.WriteValue(value.w);
			writer.WriteEndObject();
		}

		public override Quaternion ReadJson(JsonReader reader, Type objectType, Quaternion existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}


	[NeedleConverter]
	public class Matrix4x4Converter : JsonConverter<Matrix4x4>
	{
		// https://github.com/Unity-Technologies/UnityCsReference/blob/2019.2/Runtime/Export/Math/Matrix4x4.cs#L21-L29
		private static readonly string[] _names = GetMemberNames();
		private static readonly Dictionary<string, int> _namesToIndex = GetNamesToIndex(_names);

		private static string[] GetMemberNames()
		{
			var indexes = new[] { "0", "1", "2", "3" };
			return indexes.SelectMany((row) => indexes.Select((column) => "m" + column + row)).ToArray();
		}

		private static Dictionary<string, int> GetNamesToIndex(string[] names)
		{
			var dict = new Dictionary<string, int>();
			for (int i = 0; i < names.Length; i++)
			{
				dict[names[i]] = i;
			}
			return dict;
		}

		public override bool CanRead => false;

		public override void WriteJson(JsonWriter writer, Matrix4x4 value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			for (int i = 0; i < _names.Length; i++)
			{
				writer.WritePropertyName(_names[i]);
				writer.WriteValue(value[i]);
			}
			writer.WriteEndObject();
		}

		public override Matrix4x4 ReadJson(JsonReader reader, Type objectType, Matrix4x4 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}
}