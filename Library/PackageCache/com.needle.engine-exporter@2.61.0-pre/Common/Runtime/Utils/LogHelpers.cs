using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class LogHelpers
	{
		public static void LogWithoutStacktrace(object message, Object context = null)
		{
			Debug.LogFormat(LogType.Log, LogOption.NoStacktrace, context, "{0}", message);
		}
		
		public static void ErrorWithoutStacktrace(object message, Object context = null)
		{
			Debug.LogFormat(LogType.Error, LogOption.NoStacktrace, context, "{0}", message);
		}
		
		public static void WithoutStacktrace(LogType type, object message, Object context = null)
		{
			Debug.LogFormat(type, LogOption.NoStacktrace, context, "{0}", message);
		}
		
		public static string AsLink(this string str, string href = null)
		{
			return "<a href=\"" + (href ?? str) + "\">" + str + "</a>";
		}
		
		public static string AsError(this string str)
		{
			return "<color=#ff2222>" + str + "</color>";
		}
		
		public static string AsSuccess(this string str)
		{
			return "<color=#00dd00>" + str + "</color>";
		}
		
		public static string LowContrast(this string str)
		{
			if (str.Contains("\n")) str = str.Replace("\n", "</color>\n<color=#888888>");
			return "<color=#888888>" + str + "</color>";
		}
	}
}