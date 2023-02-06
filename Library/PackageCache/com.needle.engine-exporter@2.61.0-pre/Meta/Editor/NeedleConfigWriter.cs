using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using UnityEngine;

namespace Needle.Engine
{
	[UsedImplicitly]
	internal class NeedleConfigWriter : IBuildStageCallbacks
	{
		private static List<JsonConverter> _converters;
		private static List<IBuildConfigProperty> _configSections;
		private static JsonSerializerSettings _serializer;

		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			if (stage != BuildStage.Setup) return Task.FromResult(true);
			UpdateConfig(context);
			return Task.FromResult(true);
		}

		public static void UpdateConfig(ExportContext context)
		{
			_converters ??= NeedleConverter.GetAll();
			_configSections ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IBuildConfigProperty>();

			if (_serializer == null)
			{
				var converters = new List<JsonConverter>(_converters) { new CopyTextureConverter() };
				_serializer ??= new JsonSerializerSettings() { Converters = converters };
			}

			var sw = new StringWriter();
			var writer = new JsonTextWriter(sw);
			writer.Formatting = Formatting.Indented;
			var serializer = JsonSerializer.Create(_serializer);

			writer.WriteStartObject();
			foreach (var config in _configSections)
			{
				if (string.IsNullOrEmpty(config.Key)) continue;

				var value = config.GetValue(context);
				writer.WritePropertyName(config.Key);
				try
				{
					serializer.Serialize(writer, value);
				}
				catch (Exception ex)
				{
					Debug.LogException(ex);
					// TODO check if this even works or if the serializer above has already written problematic data at this point
					writer.WriteRaw("undefined");
				}
			}
			writer.WriteEndObject();

			var jsonData = sw.ToString();
			File.WriteAllText(context.Project.GeneratedDirectory + "/meta.json", jsonData);
		}
	}
}