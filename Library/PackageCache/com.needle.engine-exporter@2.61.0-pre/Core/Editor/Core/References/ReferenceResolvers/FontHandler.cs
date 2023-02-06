using UnityEngine;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class FontResolver : IReferenceResolver
	{
		// private const string BuiltinExtraResources = "Resources/unity_builtin_extra";
		// private const string BuiltinResources = "Library/unity default resources";
		// private static Object[] builtInResources = null;
		

		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result)
		{
			if (value is Font font)
			{
				result = "\"" + font.name + "\"";
				return true;
				// var assetPath = AssetDatabase.GetAssetPath(font);
				// if (assetPath.Equals(BuiltinResources))
				// {
				// 	Debug.Log(assetPath + ", " + File.Exists(assetPath));
				// 	builtInResources ??= AssetDatabase.LoadAllAssetsAtPath(BuiltinResources);
				// 	foreach (var res in builtInResources)
				// 	{
				// 		if (res == font)
				// 		{
				// 			// var dir = resolver.ExportContext!.Project.AssetsDirectory;
				// 			// var filePath = dir + "/" + font.name + "";
				// 			// var copy = Object.Instantiate(font);
				// 			// copy.name = font.name;
				// 			// UnityEditorInternal.InternalEditorUtility.SaveToSerializedFileAndForget(new []{copy},filePath, true);
				// 			result = "\"" + font.name + "\"";
				// 			return true;
				// 		}
				// 	}
				// }
			}
			result = null;
			return false;
		}
	}
}