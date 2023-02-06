using GLTF.Schema;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine.Timeline;

namespace Needle.Engine.Timeline
{
	public class TimelineAssetExtension : IExtension
	{
		public const string EXTENSION_NAME = "NEEDLE_timeline";

		public readonly PlayableDirectorExportContext context;

		public TimelineAssetExtension(PlayableDirectorExportContext context)
		{
			this.context = context;
		}

		public JProperty Serialize()
		{
			var obj = new JObject();
			var asset = context.Director.playableAsset as TimelineAsset;
			if (TimelineSerializer.TryExportPlayableAsset(context, asset, out var res))
			{
				var json = JsonConvert.SerializeObject(res);
				obj.Add("playableAsset", new JRaw(json));
			}
			return new JProperty(EXTENSION_NAME, obj);
		}

		public IExtension Clone(GLTFRoot root)
		{
			return new TimelineAssetExtension(context);
		}
	}
}