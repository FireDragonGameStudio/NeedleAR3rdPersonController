#nullable enable
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Needle.Engine.Core.References;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Serialization
{
	public class NeedleContractResolver : DefaultContractResolver
	{
		private static ITypeMemberHandler[]? MemberHandlers;
		private readonly IExportContext Context;
		private readonly IValueResolver? ValueResolver;

		public NeedleContractResolver(IExportContext context, IValueResolver? prov)
		{
			Context = context;
			ValueResolver = prov;
		}

		private static bool IsNotCompilerGenerated(MemberInfo m) =>
			!m.CustomAttributes.Any(x => x.AttributeType == typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute));

		private static readonly Dictionary<Type, FieldInfo[]> fields = new Dictionary<Type, FieldInfo[]>();

		protected override IList<JsonProperty> CreateProperties(Type type,
			MemberSerialization memberSerialization)
		{
			
			var members = GetSerializableMembers(type);
			if (members == null)
				throw new JsonSerializationException("Null collection of serializable members returned.");

			// var publicProperties = type
			// 	.GetProperties(BindingFlags.Instance)
			// 	.Where(IsNotCompilerGenerated);
			// members.AddRange(publicProperties);
			//
			// var publicFields = type
			// 	.GetFields(BindingFlags.Instance)
			// 	.Where(IsNotCompilerGenerated);
			// members.AddRange(publicFields);

			if (!fields.TryGetValue(type, out var privateSerializedFields))
			{
				privateSerializedFields = type
					.GetFields(BindingFlags.NonPublic | BindingFlags.Instance)
					.Where(f => f.GetCustomAttribute<SerializeField>() != null)
					.Where(IsNotCompilerGenerated).ToArray();
				fields.Add(type, privateSerializedFields);
			}
			members.AddRange(privateSerializedFields);

			var properties = new JsonPropertyCollection(type);
			foreach (var member in members)
			{
				var property = CreateProperty(member, memberSerialization);
				property.Writable = true;
				property.Readable = true;
				if (!properties.Any(p => p.PropertyName == property.PropertyName))
					properties.AddProperty(property);
			}
			return properties;
		}

		private static readonly List<(object key, object value)> additionalDataBuffer = new List<(object, object)>();
		private static readonly List<IAdditionalComponentDataProvider> tempAdditionalComponent = new List<IAdditionalComponentDataProvider>();

		protected override JsonContract CreateContract(Type objectType)
		{
			// a problem we had was Animation component implementing IEnumerable so it did create a ArrayContract
			// but our value resolver returns an JObject like { guid : .... } so that failed
			if (typeof(Component).IsAssignableFrom(objectType)) return CreateObjectContract(objectType);
			return base.CreateContract(objectType);
		}

		protected override JsonObjectContract CreateObjectContract(Type objectType)
		{
			var c = base.CreateObjectContract(objectType);
			c.ExtensionDataGetter = value =>
			{
				var list = default(List<KeyValuePair<object, object>>);

				if (value is JToken)
				{
					if (value is JObject obj)
					{
						// e.g. when emitting "{ guid : "123" }" object in GltfValueResolver we want to make sure this data is actually written out
						// because when OrbitControls did reference LookAtConstraint it did instead only write properties that were defined in LookAtConstraint (due to the contract)
						// The workaround here is: when the value for a field is a JObject
						// we want to write those fields out to the component itself.
						// TBD: what happens if any field ACTUALLY holds a JObject reference? should be introduce a custom type (maybe derived from JObject?) to be SURE not to mess up the data we expect? 
						list ??= new List<KeyValuePair<object, object>>();
						foreach (var key in obj)
							list.Add(new KeyValuePair<object, object>(key.Key, key.Value!));
					}
				}
				else
				{
					// here we can callback to special data emitters
					var add = AdditionalDataProviders.Instances;
					additionalDataBuffer.Clear();
					foreach (var ad in add)
					{
						ad.GetAdditionalData(this.Context, value, additionalDataBuffer);
					}

					if (value is Component comp && comp)
					{
						tempAdditionalComponent.Clear();
						comp.GetComponents(tempAdditionalComponent);
						foreach (var gen in tempAdditionalComponent)
							gen.OnSerialize(comp, additionalDataBuffer);
					}

					if (additionalDataBuffer.Count > 0 && list == null)
						list ??= new List<KeyValuePair<object, object>>();
					for (var index = 0; index < additionalDataBuffer.Count; index++)
					{
						var kvp = additionalDataBuffer[index];
						list!.Add(new KeyValuePair<object, object>(kvp.key, kvp.value));
					}
				}

				return list;
			};
			return c;
		}

		protected override JsonProperty CreateProperty(MemberInfo member, MemberSerialization memberSerialization)
		{
			var property = base.CreateProperty(member, memberSerialization);
			MemberHandlers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypeMemberHandler>().ToArray();

			if (ValueResolver != null && property.ValueProvider != null)
			{
				var prov = new WrappedValueResolver(Context, property, property.ValueProvider, member, MemberHandlers, ValueResolver);
				property.ValueProvider = prov;
			}

			var handleChangeName = false;
			var shouldSerializeDefault = property.ShouldSerialize;
			property.ShouldSerialize = o =>
			{
				// TODO: currently rect transform serializes a full gameObject/transforms as well
				// if (typeof(Transform).IsAssignableFrom(member.DeclaringType))
				// {
				// 	if (member.Name.IndexOf("gameobject", StringComparison.CurrentCultureIgnoreCase) >= 0)
				// 	{
				// 		
				// 	}
				// }
				// if (o is RectTransform && member.Name == "gameObject") return false;
				// if (o is Transform && typeof(Transform).IsAssignableFrom(o.GetType().DeclaringType)) return false;

				// when serializing OrbitControls.LookAtConstraint reference
				if (o is JToken) return false;
				// when serialized value is json pointer
				if (o is string) return false;
				// dont serialize gameObject
				if (member.DeclaringType == typeof(Component) && o is GameObject && member.Name == nameof(Component.gameObject)) return false;

				var type = o.GetType();
				foreach (var mem in MemberHandlers)
				{
					if (mem.ShouldIgnore(type, member))
						return false;
				}

				if (!handleChangeName)
				{
					handleChangeName = true;
					foreach (var mem in MemberHandlers)
					{
						if (mem.ShouldRename(member, out var name))
						{
							property.PropertyName = name;
						}
					}
				}

				return shouldSerializeDefault?.Invoke(o) ?? true;
			};

			return property;
		}

		protected override string ResolvePropertyName(string propertyName)
		{
			var name = base.ResolvePropertyName(propertyName);
			// TODO: do we really want to modify property names? e.g. camel case?!

			name = name.ToJsVariable();
			return name;
		}
	}

	internal class WrappedValueResolver : IValueProvider
	{
		private readonly IExportContext Context;
		private readonly IValueProvider Value;
		private readonly MemberInfo Member;
		private readonly ITypeMemberHandler[] MemberHandlers;
		private readonly IValueResolver Resolver;
		private readonly JsonProperty Property;

		public WrappedValueResolver(
			IExportContext context,
			JsonProperty property,
			IValueProvider value,
			MemberInfo member,
			ITypeMemberHandler[] memberHandlers,
			IValueResolver resolver)
		{
			Context = context;
			Property = property;
			Value = value;
			Member = member;
			MemberHandlers = memberHandlers;
			this.Resolver = resolver;
		}

		public void SetValue(object target, object? value)
		{
			Value.SetValue(target, value);
		}

		public object? GetValue(object? target)
		{
			if (target == null || (target is Object o && !o)) return null;
			if (target is string) return target;
			var value = Value.GetValue(target);
			var type = value?.GetType();
			Resolver.TryGetValue(Context, target, Member, ref value);
			if (type != null)
			{
				// if the object was resolved to a string / json pointer (or exported as a path)
				// we want to override newtonsofts serialization and just output the string
				if (type != typeof(string) && (value is string || IsListOfStrings(value)))
					ObjectValueConverter.Inject(Property);
				// a LayerMask is originally serialized as { value: 0 }
				// but we want it to serialize as a plain number directly
				else if(type == typeof(LayerMask))
					ObjectValueConverter.Inject(Property);
			}
			return value;
		}

		private bool IsListOfStrings(object value)
		{
			if (value is IList list)
			{
				var foundAnyString = false;
				if (list.Count <= 0) return false;
				foreach (var e in list)
				{
					if (e is string)
					{
						foundAnyString = true;
						continue;
					}
					if (e is null) continue;
					return false;
				}
				return foundAnyString;
			}
			return false;
		}
	}


	/// <summary>
	/// Used to modify override serialization of an object if e.g. ValueResolver returned a json pointer instead of serializing the object in place
	/// Then in this case we have a string instead of an object and newtonsoft would normally now iterate of the JsonContract properties that was
	/// previously created for a type. But instead we want to just write out the string/json pointer
	/// </summary>
	internal class ObjectValueConverter : JsonConverter
	{
		private static readonly Stack<ObjectValueConverter> stack = new Stack<ObjectValueConverter>();

		private JsonProperty property = null!;
		private JsonConverter? previousConverter;

		public static void Inject(JsonProperty property)
		{
			ObjectValueConverter inst;
			inst = stack.Count <= 0 ? new ObjectValueConverter() : stack.Pop();
			inst.property = property;
			inst.previousConverter = property.Converter;
			property.Converter = inst;
		}

		public override void WriteJson(JsonWriter writer, object? value, JsonSerializer serializer)
		{
			if (value is IList list)
			{
				writer.WriteStartArray();
				foreach (var entry in list)
				{
					writer.WriteValue(entry);
				}
				writer.WriteEndArray();
			}
			else
				writer.WriteValue(value);
			property.Converter = previousConverter;
			stack.Push(this);
		}

		public override object? ReadJson(JsonReader reader, Type objectType, object? existingValue, JsonSerializer serializer)
		{
			throw new NotImplementedException();
		}

		public override bool CanRead => false;

		public override bool CanConvert(Type objectType)
		{
			return true;
		}
	}
}