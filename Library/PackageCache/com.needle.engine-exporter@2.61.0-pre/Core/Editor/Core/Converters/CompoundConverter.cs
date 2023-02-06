using System.Collections.Generic;

namespace Needle.Engine.Core.Converters
{
	public class CompoundConverter : IJavascriptConverter
	{
		public readonly IList<IJavascriptConverter> Converters;

		public CompoundConverter(params IJavascriptConverter[] converters)
		{
			this.Converters = converters;
		}
		
		public bool TryConvertToJs(object value, out string js)
		{
			foreach (var conv in Converters)
			{
				if (conv.TryConvertToJs(value, out js)) return true;
			}
			js = null;
			return false;
		}
	}
}