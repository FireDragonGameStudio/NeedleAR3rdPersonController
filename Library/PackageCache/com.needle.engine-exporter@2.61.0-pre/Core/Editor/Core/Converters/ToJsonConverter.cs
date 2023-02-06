using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Needle.Engine.Core.Converters
{
	public class ToJsonConverter : IJavascriptConverter
	{
		public bool TryConvertToJs(object value, out string js)
		{
			var jObj = new JObject();
			// jObj["$type"] = value.GetType().Name;
			switch (value)
			{
				case Vector2 val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					js = jObj.ToString();
					return true;
				case Vector2Int val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					js = jObj.ToString();
					return true;
				case Vector3 val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					jObj["z"] = val.z;
					js = jObj.ToString();
					return true;
				case Vector3Int val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					jObj["z"] = val.z;
					js = jObj.ToString();
					return true;
				case Vector4 val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					jObj["z"] = val.z;
					jObj["w"] = val.w;
					js = jObj.ToString();
					return true;
				case Quaternion val:
					jObj["x"] = val.x;
					jObj["y"] = val.y;
					jObj["z"] = val.z;
					jObj["w"] = val.w;
					js = jObj.ToString();
					return true;
			}

			js = null;
			return false;
		}
	}
}