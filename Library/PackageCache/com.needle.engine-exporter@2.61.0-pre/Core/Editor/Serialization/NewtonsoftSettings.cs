using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Serialization
{
	public static class NewtonsoftSettings
	{

		public static JsonSerializerSettings Create(IExportContext context, IValueResolver resolver)
		{
			var set = new JsonSerializerSettings();
			set.ContractResolver = new NeedleContractResolver(context, resolver);
			set.PreserveReferencesHandling = PreserveReferencesHandling.None;
			foreach (var conv in NeedleConverter.GetAll()) 
				set.Converters.Add(conv);
			set.Error += OnError;
			// set.ReferenceResolverProvider = () => new ReferenceResolver();
			// set.PreserveReferencesHandling = PreserveReferencesHandling.All;
			// set.ReferenceLoopHandling = ReferenceLoopHandling.Serialize;
			return set;
		}

		private static void OnError(object sender, ErrorEventArgs e)
		{
			e.ErrorContext.Handled = true;
			// TODO: for serializing UI in gltf we need to serialize RectTransforms. This is a workaround for CircularSerializationException
			if (e.CurrentObject is RectTransform && (string)e.ErrorContext.Member == nameof(Transform.gameObject))
			{
				return;
			}
			Debug.LogException(e.ErrorContext.Error, e.CurrentObject as Object);
		}
	}
}