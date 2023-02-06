using System;
using System.IO;
using UnityEditor;
using UnityEngine.Video;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class VideoResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path1, object value, out string result)
		{
			if (value is VideoClip clip)
			{
				result = "\"" + ExportVideoClip(clip, resolver.ExportContext!.AssetsDirectory) + "\"";
				return true;
			}
			// if (resolver.CurrentField?.Owner is VideoPlayer && resolver.CurrentField.Name == "url")
			// {
			// 	
			// }
			
			result = null;
			return false;
		}

		public static string ExportVideoClip(VideoClip clip, string assetDirectory)
		{
			var path = AssetDatabase.GetAssetPath(clip);
			var name = Path.GetFileName(path);
			var outputPath = assetDirectory + "/" + name;
				
			// var scriptInfo = resolver.ExportContext.KnownScripts.FirstOrDefault(s => s.TypeName == nameof(AudioSource));
			// Debug.Assert(scriptInfo != null, "Failed finding script path for " + value, value as Object);
			var rel = new Uri(assetDirectory).MakeRelativeUri(new Uri(outputPath));
			var result = $"./{rel}";
				
			File.Copy(path, outputPath, true);
			return result;
		}
	}
}