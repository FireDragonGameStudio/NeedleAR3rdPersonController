using UnityEngine;

namespace Needle.Engine.Core.Converters
{
	public class UnityTypeConverter : IJavascriptConverter
	{
		public bool TryConvertToJs(object value, out string js)
		{
			if (value is LayerMask mask)
			{
				js = mask.value.ToString();
				return true;
			}
			js = null;
			return false;
		}
	}
}