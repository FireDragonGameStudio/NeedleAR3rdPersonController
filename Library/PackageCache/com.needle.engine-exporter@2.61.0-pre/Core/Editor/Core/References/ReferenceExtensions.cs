using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine.UIElements;

namespace Needle.Engine.Core.References
{
	public static class ReferenceExtensions
	{
		private static readonly Regex invalidCharacters = new Regex(@"[\(\) -\.:]");
		private static Dictionary<string, string> nameCache = new Dictionary<string, string>();

		public static string ToJsVariable(this string name)
		{
			var res = name;
			ToJsVariable(ref res);
			return res;
		}
		
		public static void ToJsVariable(ref string name)
		{
			if(nameCache.TryGetValue(name, out var cached))
			{
				name = cached;
				return;
			}
			var res = invalidCharacters.Replace(name, "");
			ToCamelCase(ref res);
			if (char.IsNumber(res[0])) res = "_" + res;
			nameCache.Add(name, res);
			name = res;
		}

		private static readonly StringBuilder sb = new StringBuilder();
		
		public static void ToCamelCase(ref string str)
		{
			if (string.IsNullOrEmpty(str) || str.Length < 2)
				return;
			sb.Clear();
			sb.Append(str);
			// TODO: should we remove this too?
			sb[0] = char.ToLowerInvariant(str[0]);
			str = sb.ToString();
		}

		// public static string ToCamelCase(this string str)
		// {
		// 	if (string.IsNullOrEmpty(str) || str.Length < 2)
		// 		return str;
		// 	return char.ToLowerInvariant(str[0]) + str.Substring(1);
		// }
	}
}