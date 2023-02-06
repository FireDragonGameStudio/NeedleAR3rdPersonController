using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Reflection;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
using Needle.Engine.Core;
using Needle.Engine.Settings;
using Needle.Engine.Serialization;
#endif

namespace Needle.Engine.Gltf
{
	public class GltfExportContext : IExportContext, IGuidProvider, IHasBuildContext
	{
		public GltfExportContext(
			IGltfExportHandler handler,
			string path,
			Transform t,
			IExportContext parent,
			IReferenceRegistry references,
			ITypeRegistry types,
			IGltfBridge bridge,
			IValueResolver res,
			object exporter
		)
		{
			this.Handler = handler;
			this.Path = path;
			this.Exporter = exporter;
			Root = t;
			ParentContext = parent;
			AssetsDirectory = ParentContext.AssetsDirectory;
			References = references;
			TypeRegistry = types;
			Bridge = bridge;
#if UNITY_EDITOR
			Serializer = new NewtonsoftSerializer(this, res);
#endif
			this.Settings = parent?.Settings.Clone() ?? ExportSettings.Default;

			debugInformation = new ExportDebugInformation(this);
		}

		public string GetExtension(Object obj)
		{
#if UNITY_EDITOR
			if (PrefabUtility.GetOutermostPrefabInstanceRoot(obj) == obj && PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(obj).EndsWith(".gltf"))
				return ".gltf";
#endif
			return ".glb";
		}

		public bool TryGetAssetDependencyInfo(Object obj, out IAssetDependencyInfo info)
		{
			return ParentContext.TryGetAssetDependencyInfo(obj, out info);
		}

		public IExportSettings Settings { get; set; }

		public int Id => ParentContext.Id;
		public string Path { get; }
		public IExportContext ParentContext { get; }

		public readonly IGltfExportHandler Handler;

		/// <summary>
		/// A reference to the exporter that is being used (e.g. GltfSceneExporter)
		/// </summary>
		public readonly object Exporter;

		public Transform Root { get; }
		public string ProjectDirectory => ParentContext?.ProjectDirectory;
		public string AssetsDirectory { get; internal set; }
		public string PackageJsonPath => ParentContext?.PackageJsonPath;

		public bool Exists()
		{
			return File.Exists(PackageJsonPath);
		}

		public bool IsInstalled()
		{
			return ParentContext?.IsInstalled() ?? false;
		}

		public IReferenceRegistry References { get; }
		public ITypeRegistry TypeRegistry { get; }
		public IGltfBridge Bridge { get; }
		public ISerializer Serializer { get; }
		public IAssetExtension AssetExtension { get; internal set; }

		public IDependencyRegistry DependencyRegistry { get; internal set; }

		public IReadOnlyList<IValueResolver> ValueResolvers => resolvers;
		private readonly List<IValueResolver> resolvers = new List<IValueResolver>();

		public void RegisterValueResolver(IValueResolver res)
		{
			if (!resolvers.Contains(res))
				resolvers.Add(res);
		}

		private readonly Dictionary<Object, string> guids = new Dictionary<Object, string>();
		private readonly IGuidProvider defaultGuidProvider = new DefaultGuidProvider();

		public string GetGuid(Object obj)
		{
			if (guids.TryGetValue(obj, out var guid)) return guid;
			return defaultGuidProvider.GetGuid(obj);
		}

		public void RegisterGuid(Object obj, string guid)
		{
			guids[obj] = guid;
		}

		private readonly ExportDebugInformation debugInformation;
		public ExportDebugInformation Debug => debugInformation;

		public IBuildContext BuildContext
		{
			get
			{
				TryGetBuildContext(out var buildContext);
				return buildContext;
			}
		}

		public bool TryGetBuildContext(out IBuildContext buildContext)
		{
#if UNITY_EDITOR
			if(ParentContext is IHasBuildContext hasBuildContext)
			{
				buildContext = hasBuildContext.BuildContext;
				return buildContext != null;
			}
#endif

			buildContext = null;
			return false;
		}

		public bool IsCurrentlyExportingToPath(string path)
		{
			if (this.Path == path) return true;
			var parent = ParentContext;
			while (parent != null)
			{
				if (parent.Path == path) return true;
				parent = parent.ParentContext;
			}
			return false;
		}

	}
}