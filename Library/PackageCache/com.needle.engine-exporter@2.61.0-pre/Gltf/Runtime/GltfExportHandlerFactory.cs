using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEditor;

namespace Needle.Engine.Gltf
{
	/// <summary>
	/// Use to create implementation for gltf exporter
	/// </summary>
	public static class GltfExportHandlerFactory
	{
		public static GltfExporterType DefaultExporter = GltfExporterType.UnityGLTF;
		
		private static Dictionary<GltfExporterType, Type> knownTypes;

		private static void RegisterExportHandlerType(GltfExporterType type, Type t)
		{
			if (!knownTypes.ContainsKey(type))
				knownTypes.Add(type, t);
			else knownTypes[type] = t;
		}

		public static IGltfExportHandler CreateHandler()
		{
			return CreateHandler(DefaultExporter);
		}

		public static IGltfExportHandler CreateHandler(GltfExporterType exporterType)
		{
#if UNITY_EDITOR
			if (knownTypes == null)
			{
				knownTypes = new Dictionary<GltfExporterType, Type>();
				foreach (var type in TypeCache.GetTypesWithAttribute<GltfExportHandlerAttribute>())
				{
					var attribute = type.GetCustomAttribute<GltfExportHandlerAttribute>();
					RegisterExportHandlerType(attribute.Type, type);
				}
			}
#endif

			if (knownTypes != null)
			{
				if (knownTypes.TryGetValue(exporterType, out var t)) 
				{
					var instance = Activator.CreateInstance(t);
					return instance as IGltfExportHandler;
				}
			}
			return null;
		}
	}
}