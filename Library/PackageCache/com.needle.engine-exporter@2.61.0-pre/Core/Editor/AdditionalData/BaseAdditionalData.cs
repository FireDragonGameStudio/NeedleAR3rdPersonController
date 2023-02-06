using System.Collections.Generic;
using System.Linq;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using Newtonsoft.Json;

namespace Needle.Engine.AdditionalData
{
	public abstract class BaseAdditionalData : IAdditionalEmitterCodegen, IAdditionalDataProvider
	{
		private static readonly List<(object key, object value)> tempBuffer = new List<(object key, object value)>();

		private static JsonSerializerSettings settings;
		
		public void EmitAdditionalData(ExportContext context, object target, string currentPath = null)
		{
			tempBuffer.Clear();
			GetAdditionalData(context, target, tempBuffer);
			for (var index = 0; index < tempBuffer.Count; index++)
			{
				var kvp = tempBuffer[index];
				settings ??= new JsonSerializerSettings() { Converters = NeedleConverter.GetAll().ToList() };
				var value = JsonConvert.SerializeObject(kvp.value, settings);
				context.Writer.Write($"{currentPath}.{kvp.key} = {value};");
			}
		}

		public abstract void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData);
	}
}