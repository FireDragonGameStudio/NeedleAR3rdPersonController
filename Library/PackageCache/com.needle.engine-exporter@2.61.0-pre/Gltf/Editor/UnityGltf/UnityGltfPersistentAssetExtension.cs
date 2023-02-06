using System.Collections.Generic;
using System.Reflection;
using GLTF.Schema;
using Needle.Engine.Serialization;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Needle.Engine.Gltf.UnityGltf
{
	public class UnityGltfPersistentAssetExtension : IExtension, IAssetExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_persistent_assets";

		private readonly GltfExportContext context;

		private readonly List<Object> assets = new List<Object>();
		private readonly List<Object> failedToSerialize = new List<Object>();

		// AnimatorControllerValueResolver needs to store the model until the whole scene was parsed
		// for cases when the controller is used on multiple objects for example
		// because we need to register the pointers per animator using the same controller
		private readonly List<ISerializablePersistentAssetModel> models = new List<ISerializablePersistentAssetModel>();
		private readonly List<object> currentlySerializing = new List<object>();
		private readonly List<JToken> serialized = new List<JToken>();

		public bool CanAdd(object owner, Object asset)
		{
			// var go = asset as GameObject;
			// if (asset is Transform t) go = t.gameObject;
			// if (go)
			// {
			// 	if(!go.TryGetComponent<IExportableObject>(out _))
			// 		return false;
			// 	if (ReferenceEquals(asset, owner))
			// 		return false;
			// 	if (owner is Component comp && comp.transform == asset)
			// 		return false;
			// }
			return true;
		}

		public object GetPathOrAdd(Object asset, object owner, MemberInfo member)
		{
			if (failedToSerialize.Contains(asset)) 
				return null;
			
			var index = this.assets.IndexOf(asset);
			if (index < 0)
			{
				var i = this.assets.Count;
				this.assets.Add(asset);
				try
				{
					currentlySerializing.Add(asset);
					this.models.Add(null);
					this.serialized.Add(null);

					// currently just used for playable asset
					object obj = asset;
					foreach (var valueResolver in context.ValueResolvers)
					{
						if (valueResolver.TryGetValue(context, owner, member, ref obj))
							break;
					}
					if (obj is ISerializablePersistentAssetModel ser)
					{
						this.models[i] = ser;
					}
					else
					{
						if (obj == null)
						{
							// if an object can not be serialized we dont want to add it to the extension at all
							// we also have to remove the entries in the list to make sure the pointer indices are correct
							failedToSerialize.Add(asset);
							var assetIndex = this.assets.IndexOf(asset);
							this.assets.RemoveAt(assetIndex);
							this.models.RemoveAt(assetIndex);
							this.serialized.RemoveAt(assetIndex);
							return null;
						}
						else this.serialized[i] = Serialize(obj);
					}
				}
				finally
				{
					currentlySerializing.RemoveAt(currentlySerializing.Count - 1);
				}
				return EXTENSION_NAME.AsExtensionPointer(i);
			}
			// if the asset was previously seen or is currently being serialized
			if (currentlySerializing.Contains(asset) || models[index] != null || serialized[index] != null)
			{
				if (models[index] != null)
				{
					var existing = models[index];
					if (existing != null)
					{
						existing.OnNewObjectDiscovered(asset, owner, member, context);
					}
				}
				return EXTENSION_NAME.AsExtensionPointer(index);
			}
			return asset;
		}

		public void AddExtension(IGltfBridge bridge)
		{
			if (assets.Count > 0)
			{
				bridge.AddExtension(EXTENSION_NAME, this);

				for (var index = 0; index < models.Count; index++)
				{
					var val = models[index];
					if (val == null) continue;
					var ser = Serialize(val);
					if (ser == null) continue;
					serialized[index] = ser;
				}
			}
		}

		public UnityGltfPersistentAssetExtension(GltfExportContext context)
		{
			this.context = context;
		}

		public JProperty Serialize()
		{
			var obj = new JObject();
			var arr = new JArray();
			obj.Add("assets", arr);
			for (var index = 0; index < serialized.Count; index++)
			{
				var ser = serialized[index];
				if (ser != null)
				{
					arr.Add(ser);
					var asset = assets[index];
					if (asset && ser is JObject)
					{
						ser["__type"] = asset.GetType().GetTypeInformation();
						if (ser["guid"] == null)
							ser["guid"] = asset.GetId();
					}
				}
			}
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			var ext = new UnityGltfPersistentAssetExtension(context);
			ext.assets.AddRange(this.assets);
			ext.models.AddRange(this.models);
			return ext;
		}

		private JToken Serialize(object obj)
		{
			var ser = context.Serializer.Serialize(obj);
			var res = JToken.Parse(ser);
			return res;
		}
	}
}