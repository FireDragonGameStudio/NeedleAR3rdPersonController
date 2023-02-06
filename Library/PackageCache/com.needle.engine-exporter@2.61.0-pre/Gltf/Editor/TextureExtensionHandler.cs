using System.Collections.Generic;
using GLTF.Schema;
using JetBrains.Annotations;
using Needle.Engine.Gltf.UnityGltf;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	[UsedImplicitly]
	public class TextureExtensionHandler : GltfExtensionHandlerBase //, ITextureExtensionFactory
	{

		private Dictionary<Texture, Dictionary<string, object>> textureExtensions;
		private static readonly List<object> tempExtensionsList = new List<object>();

		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			textureExtensions?.Clear();
		}

		public override void OnBeforeTextureExport(GltfExportContext context, ref TextureExportSettings settings, string textureSlot)
		{
			var handlers = TextureExportHandlerRegistry.List;
			if (handlers == null) return;
			foreach (var handler in handlers)
			{
				tempExtensionsList.Clear();
				if (handler.OnTextureExport(context, ref settings, textureSlot, tempExtensionsList))
				{
					var key = settings.Texture;
					foreach (var model in tempExtensionsList)
					{
						if (model == null) continue;
						var extensionName = model.GetType().Name;
						
						textureExtensions ??= new Dictionary<Texture, Dictionary<string, object>>();
						if (!textureExtensions.ContainsKey(key)) textureExtensions.Add(key, new Dictionary<string, object>());
						var dict = textureExtensions[key];
						if (dict.ContainsKey(extensionName))
						{
							if (dict[extensionName].Equals(model)) continue;
							// Debug.LogWarning("Override extension: " + extensionName + ", " + key.name, key);
							dict[extensionName] = model;
						}
						else dict.Add(extensionName, model);
					}
				}
			}
		}

		public override void OnAfterTextureExport(GltfExportContext context, int id, TextureExportSettings settings)
		{
			if (textureExtensions == null) return;
			if (textureExtensions.TryGetValue(settings.Texture, out var list))
			{
				foreach (var model in list)
				{
					var name = model.Key;
					var extension = model.Value;
					var json = JObject.Parse(context.Serializer.Serialize(extension));
					var ext = CreateExtension(context, name, json);
					context.Bridge.AddTextureExtension(id, name, ext);
				}
			}
			textureExtensions.Clear();
			base.OnAfterTextureExport(context, id, settings);
		}
		
		private static IExtension CreateExtension(GltfExportContext context, string name, JObject obj)
		{
			// this could check which exporter we're using and once gltfast has support for it
			// we return the gltfast extension version
			if (context.IsExportType(GltfExporterType.UnityGLTF))
				return new UnityGltfOpaqueExtension(name, obj);
			return null;
		}
	}
}