using System;
using Newtonsoft.Json.Linq;

namespace Needle.Engine.Serialization
{
	public static class TypeSerialization
	{
		public static JToken GetTypeInformation(this Type type)
		{
			return new JValue(type.Name);
		}
	}
}