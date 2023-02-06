using UnityEditor;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	internal static class Assets
	{
		private const string _iconGuid = "accb597a5beb7504bb67dea37d8dff40";
		private static Texture2D _icon;
		public static Texture2D Icon
		{
			get
			{
				if (_icon) return _icon;
				var path = AssetDatabase.GUIDToAssetPath(_iconGuid);
				if (path != null)
				{
					return _icon = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
				}
				_icon = Texture2D.blackTexture;
				return _icon;
			}
		}
	}
}