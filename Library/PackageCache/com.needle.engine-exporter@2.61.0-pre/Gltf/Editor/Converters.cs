#if UNITY_EDITOR
using System;
using System.Collections;
using System.Reflection;
using GLTF.Schema;
using Needle.Engine.Core.Converters;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityGLTF;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	public static class Converters
	{
		public static readonly IJavascriptConverter DefaultConverter = new CompoundConverter(
			new JavascriptConverter(), new ToJsonConverter());
	}
}
#endif