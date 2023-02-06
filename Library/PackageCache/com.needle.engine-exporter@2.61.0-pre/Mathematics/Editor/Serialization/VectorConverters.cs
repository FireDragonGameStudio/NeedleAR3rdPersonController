#if MATHEMATICS_INSTALLED
using System;
using Newtonsoft.Json;
using Unity.Mathematics;

namespace Needle.Engine.Mathematics
{
	[NeedleConverter]
	public class Float2Converter : JsonConverter<float2>
	{
		public override void WriteJson(JsonWriter writer, float2 value, JsonSerializer serializer)
		{
			writer.WriteStartObject();
			writer.WritePropertyName(nameof(value.x));
			writer.WriteValue(value.x);
			writer.WritePropertyName(nameof(value.y));
			writer.WriteValue(value.y);
			writer.WriteEndObject();
		}

		public override bool CanRead => false;

		public override float2 ReadJson(JsonReader reader, Type objectType, float2 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}
	
	[NeedleConverter]
	public class Float3Converter : JsonConverter<float3>
	{
		public override void WriteJson(JsonWriter writer, float3 value, JsonSerializer serializer)
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

		public override bool CanRead => false;

		public override float3 ReadJson(JsonReader reader, Type objectType, float3 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}
	
	[NeedleConverter]
	public class Float4Converter : JsonConverter<float4>
	{
		public override void WriteJson(JsonWriter writer, float4 value, JsonSerializer serializer)
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

		public override bool CanRead => false;

		public override float4 ReadJson(JsonReader reader, Type objectType, float4 existingValue, bool hasExistingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}
	}
}
#endif