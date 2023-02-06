using System;
using System.IO;
using JetBrains.Annotations;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	[UsedImplicitly]
	public class AudioResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path1, object value, out string result)
		{
			if (value is AudioClip clip && clip)
			{
				result = "\"" + ExportAudioClip(clip, resolver.ExportContext!.Project.AssetsDirectory) + "\"";
				return true;
			}
			result = null;
			return false;
		}

		public static string ExportAudioClip(AudioClip clip, string assetDirectory)
		{
			if (!clip) return null;
			var path = AssetDatabase.GetAssetPath(clip);
			var name = Path.GetFileName(path);
			var outputPath = assetDirectory+ "/" + name;
				
			// var scriptInfo = resolver.ExportContext.KnownScripts.FirstOrDefault(s => s.TypeName == nameof(AudioSource));
			// Debug.Assert(scriptInfo != null, "Failed finding script path for " + value, value as Object);
			var rel = new Uri(assetDirectory).MakeRelativeUri(new Uri(outputPath));
			var result = $"./{rel}";
			File.Copy(path, outputPath, true);
			return result;
		}
	}
}