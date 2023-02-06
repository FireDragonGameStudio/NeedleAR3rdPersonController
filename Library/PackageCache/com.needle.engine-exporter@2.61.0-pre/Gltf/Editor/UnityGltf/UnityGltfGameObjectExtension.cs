#if UNITY_EDITOR
using GLTF.Schema;
using JetBrains.Annotations;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Needle.Engine.Gltf.UnityGltf
{
	[UsedImplicitly]
	public class UnityGltfGameObjectDataExtension : GltfExtensionHandlerBase
	{
		public override void OnAfterNodeExport(GltfExportContext context, Transform transform, int nodeId)
		{
			base.OnAfterNodeExport(context, transform, nodeId);
			var ext = new GameObjectDataExtension(transform.gameObject, context);
			context.Bridge.AddNodeExtension(nodeId, GameObjectDataExtension.EXTENSION_NAME, ext);
		}
	}

	public class GameObjectDataExtension : IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_gameobject_data";
		public readonly GameObject GameObject;
		public readonly IGuidProvider GuidProvider;

		public GameObjectDataExtension(GameObject gameObject, IGuidProvider guidProvider)
		{
			GameObject = gameObject;
			this.GuidProvider = guidProvider;
		}

		public JProperty Serialize()
		{
			var obj = new JObject();
			if (this.GameObject.layer != 0)
				obj.Add("layers", new JRaw(this.GameObject.layer));
			if (!GameObject.CompareTag("Untagged"))
				obj.Add("tag", GameObject.tag);
			if (GameObject.hideFlags != HideFlags.None)
				obj.Add("hideFlags", new JRaw(GameObject.hideFlags.GetHashCode()));
			if (GameObject.isStatic != false)
				obj.Add("static", GameObject.isStatic);
			if(GameObject.activeSelf != true)
				obj.Add("activeSelf", GameObject.activeSelf);
			// try get the guid from the provider first
			// this is relevant in cases for export time created (and destroyed) gameObjects that still must have a stable guid
			// so they can register a guid on creation on the GltfExportContext
			var guid = GuidProvider?.GetGuid(GameObject) ?? GameObject.GetId();
			obj.Add("guid", guid);
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new GameObjectDataExtension(this.GameObject, this.GuidProvider);
		}
	}
}
#endif