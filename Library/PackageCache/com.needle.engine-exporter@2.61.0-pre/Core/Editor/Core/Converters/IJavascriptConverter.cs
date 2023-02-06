namespace Needle.Engine.Core.Converters
{
	public interface IJavascriptConverter
	{
		bool TryConvertToJs(object value, out string js);
	}

	public static class JsConverter
	{
		public static IJavascriptConverter CreateDefault() => new CompoundConverter(
				new JavascriptConverter(true),
				new ThreeJsConverter(),
				new UnityTypeConverter()
			);
	}
}