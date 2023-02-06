using System;
using System.Security.Cryptography;
using System.Text;

namespace Needle.Engine.Utils
{
	public static class GuidGenerator
	{
		public static string GetGuid(string str)
		{
			using var md5 = MD5.Create();
			var inputBytes = Encoding.ASCII.GetBytes(str);
			var hashBytes = md5.ComputeHash(inputBytes);
			var sb = new StringBuilder();
			foreach (var t in hashBytes)
			{
				sb.Append(t.ToString("X2"));
			}
			return sb.ToString().ToLower();
		}
		
		public static string GetGuidWithDashes(string str)
		{
			using var md5 = MD5.Create();
			var inputBytes = Encoding.ASCII.GetBytes(str);
			var hashBytes = md5.ComputeHash(inputBytes);
			return new Guid(hashBytes).ToString();
		}
	}
}