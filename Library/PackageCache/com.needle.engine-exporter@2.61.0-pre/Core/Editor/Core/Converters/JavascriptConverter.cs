using System;
using System.Collections;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.Converters
{
	public class JavascriptConverter : IJavascriptConverter
	{
		private readonly bool allowTraverseObjects = false;

		public JavascriptConverter(bool allowTraverseObjects = false)
		{
			this.allowTraverseObjects = allowTraverseObjects;
		}
		
		public bool TryConvertToJs(object value, out string js)
		{
			js = default;
			
			if (value == null || value is Object obj && !obj)
			{
				js = "null";
				return true;
			}
			var type = value.GetType();
			if (type.IsPrimitive)
			{
				if (value is bool b) js = b ? "true" : "false";
				else js = value.ToString();
				return true;
			}
			if (type == typeof(string))
			{
				js = $"`{(string)value}`";
				return true;
			}
			if (value is Enum en)
			{
				js = en.GetHashCode().ToString();
				return true;
			}
			if (value is IList arr)
			{
				if (arr is CallInfo[]) return false;
				if (arr.Count <= 0)
				{
					js = "[]";
					return true;
				}
				// iterate all array entries and try to build primitives array
				foreach (var val in arr)
				{
					if (TryConvertToJs(val, out var entry))
					{
						if (js == null) js = "[" + entry;
						else js += ", " + entry;
					}
					// abort if any entry fails
					else return false;
				}
				if (js != null) js += "]";
				return true;
			}
			if (allowTraverseObjects)
			{
				// TODO
			}

			return false;
		}
	}
}