#if UNITY_EDITOR
using System.Collections.Generic;
using GLTF.Schema;
using Needle.Engine.Serialization;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Needle.Engine.Gltf.UnityGltf
{
	public class UnityGltf_NEEDLE_components_Extension : IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_components";

		public static string GetPath(int index)
		{
			return "builtin_components/" + index;
		}

		public readonly Transform transform;
		public readonly string name;
		private readonly IExportContext context;
		private readonly IValueResolver resolver;
		private readonly IList<Component> list;
		private readonly IGuidProvider guidProvider;
		private JProperty property;

		internal IReadOnlyList<Component> List => list as IReadOnlyList<Component>;

		public UnityGltf_NEEDLE_components_Extension(Transform t, IExportContext context, IGuidProvider guidProvider, IValueResolver resolver, IList<Component> list)
		{
			this.transform = t;
			this.name = transform.name;
			this.context = context;
			this.resolver = resolver;
			this.list = list;
			this.guidProvider = guidProvider;
		}

		internal void OnAfterExport()
		{
			// we are calling serialize after scene export and before "final" serialization
			// to allow newtonsoft callbacks to add references to meshes, materials, ...
			property = InternalSerialize(context, guidProvider, resolver, list);
		}

		public JProperty Serialize()
		{
			return property;
		}

		public IExtension Clone(GLTFRoot root)
		{
			return null;
		}

		private const HideFlags _hiddenHideFlags = HideFlags.HideInInspector | HideFlags.HideInHierarchy;

		private static JProperty InternalSerialize(IExportContext ctx, IGuidProvider guidProvider, IValueResolver resolver, IList<Component> components)
		{
			if (components == null) return null;

			var ext = new JObject();
			if (ctx is GltfExportContext context)
			{
				var componentsArray = new JArray();
				ext.Add("builtin_components", componentsArray);
				foreach (var comp in components)
				{
					if (comp is Transform && !(comp is RectTransform))
						continue;
					if ((comp.hideFlags & _hiddenHideFlags) != 0 || (comp.gameObject.hideFlags & _hiddenHideFlags) != 0)
					{
						if (comp.name == "__CMVolumes")
						{
							// Cinemachine generates hidden __CMVolumes objects and components
							// how should we handle this properly? It currently completely overrides Volume objects
							Debug.LogWarning("Ignore hidden Cinemachine volume component: " + comp, comp);
							continue;
						}
					}
					// if (comp is Transform) continue;
					// currently unsupported:
					// if (comp is ParticleSystem) continue;

					var type = comp.GetType();

					var obj = new JObject();
					componentsArray.Add(obj);
					obj.Add("name", type.GetTypeInformation());
					var guid = guidProvider?.GetGuid(comp) ?? comp.GetId();
					obj.Add("guid", guid);
					var json = context.Serializer.Serialize(comp);
					if (json.StartsWith("{"))
					{
						obj.Merge(JObject.Parse(json));
					}
				}
			}

			return new JProperty(EXTENSION_NAME, ext);
		}
	}
}
#endif