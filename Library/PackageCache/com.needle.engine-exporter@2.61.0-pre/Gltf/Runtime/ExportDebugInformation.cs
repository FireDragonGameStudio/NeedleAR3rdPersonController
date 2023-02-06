#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using Unity.Profiling;
using UnityEngine;
using Object = UnityEngine.Object;
#if UNITY_EDITOR
using Needle.Engine.Settings;
using UnityEditor;
#endif

namespace Needle.Engine.Gltf
{
	public class ExportDebugInformation
	{
		private static readonly Regex keyReplaceRegex = new Regex("[,\\,\\(\\)\\]\\[]", RegexOptions.Compiled);

		private static void SanitizeKey(ref string key)
		{
			key = keyReplaceRegex.Replace(key, "");
		}


		private readonly bool enabled;
		private readonly GltfExportContext context;
		private readonly Dictionary<object?, List<Reference>> references = new Dictionary<object?, List<Reference>>();
		private ProfilerMarker reportMarker = new ProfilerMarker("Gltf Exporter: Report");

		internal ExportDebugInformation(GltfExportContext context)
		{
#if UNITY_EDITOR
			enabled = ExporterProjectSettings.instance.generateReport;
#endif
			this.context = context;
		}

		public void WriteDebugReferenceInfo(object? owner, string memberName, object? value)
		{
#if UNITY_EDITOR
			if (!enabled) return;
			if (value == null) return;

			if (value is Object obj && EditorUtility.IsPersistent(obj))
			{
				using (reportMarker.Auto())
				{
					try
					{
						var assetPath = AssetDatabase.GetAssetPath(obj);

						var key = value.GetType().FullName ?? value.GetType().Name;
						SanitizeKey(ref key);
						if (!references.TryGetValue(key, out var list))
						{
							list = new List<Reference>();
							references.Add(key, list);
						}

						var reference = new Reference();
						reference.owner = owner?.ToString();
						reference.property = memberName;
						reference.type = value.GetType().FullName ?? value.GetType().Name;
						reference.id = GlobalObjectId.GetGlobalObjectIdSlow(obj).ToString();
						var fileInfo = new FileInfo(assetPath);
						if (fileInfo.Exists)
							reference.size = fileInfo.Length;
						if (!list.Contains(reference))
							list.Add(reference);
					}
					catch (Exception ex)
					{
						if(ExporterProjectSettings.instance.debugMode) 
							Debug.LogException(ex);
					}
				}
			}

			if (value is Material mat)
			{
				using (reportMarker.Auto())
				{
					foreach (var texturePropertyName in mat.GetTexturePropertyNames())
					{
						var tex = mat.GetTexture(texturePropertyName);
						WriteDebugReferenceInfo(mat, texturePropertyName, tex);
					}
				}
			}
#endif
		}

		public void Flush()
		{
#if UNITY_EDITOR
			if (!enabled) return;
			var directory = Application.dataPath + "/../Temp/Needle/Export/Debug";
			Directory.CreateDirectory(directory);
			var path = directory + "/" + context.Root.name + ".debug.json";
			var json = JsonConvert.SerializeObject(this.references, Formatting.Indented);
			Debug.Log($"Write {context.Root.name} debug information to {path.AsLink()}");
			File.WriteAllText(path, json);
#endif
		}

		[Serializable]
		private struct Reference : IEquatable<Reference>
		{
			public string? owner;
			public string property;
			public string type;
			public long size;
			public string id;

			public bool Equals(Reference other)
			{
				return owner == other.owner && property == other.property && type == other.type && size == other.size && id == other.id;
			}

			public override bool Equals(object? obj)
			{
				return obj is Reference other && Equals(other);
			}

			public override int GetHashCode()
			{
				unchecked
				{
					var hashCode = (owner != null ? owner.GetHashCode() : 0);
					hashCode = (hashCode * 397) ^ property.GetHashCode();
					hashCode = (hashCode * 397) ^ type.GetHashCode();
					hashCode = (hashCode * 397) ^ size.GetHashCode();
					hashCode = (hashCode * 397) ^ id.GetHashCode();
					return hashCode;
				}
			}
		}
	}
}