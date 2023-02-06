using UnityEditor;

namespace Needle.Engine.Deployment
{
	internal static class SecretsHelper
	{
		public static string GetSecret(string key)
		{
			return EditorPrefs.GetString(key);
		}

		public static void SetSecret(string key, string secret)
		{
			EditorPrefs.SetString(key, secret);
		}
	}
}