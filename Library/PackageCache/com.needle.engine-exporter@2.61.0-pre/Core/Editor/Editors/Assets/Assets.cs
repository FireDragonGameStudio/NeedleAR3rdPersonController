using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Editors
{
	internal static class Assets
	{
		private const string _iconGuid = "39a802f6842d896498768ef6444afe6f";
		private static Texture2D _logo;
		public static Texture2D Logo
		{
			get
			{
				if (_logo) return _logo;
				var path = AssetDatabase.GUIDToAssetPath(_iconGuid);
				if (path != null)
				{
					return _logo = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
				}
				_logo = Texture2D.blackTexture;
				return _logo;
			}
		}
		
		private const string _circleGuid = "123494bd6dd53364a904ebc3694051c6";
		private static Texture2D _circle;
		public static Texture2D Circle
		{
			get
			{
				if (_circle) return _circle;
				var path = AssetDatabase.GUIDToAssetPath(_circleGuid);
				if (path != null)
				{
					return _circle = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
				}
				_circle = Texture2D.blackTexture;
				return _circle;
			}
		}
	}
}