using System.IO;
using Needle.Engine.Utils;
using UnityEngine;
#if UNITY_EDITOR
using Needle.Engine.Core;
using Needle.Engine.Core.References;
#endif

namespace Needle.Engine.Gltf
{
	public class ObjectExportContext : IExportContext, IHasBuildContext
	{
		public Transform Root { get; }
		public IExportSettings ExportSettings { get; set; }
		public int Id { get; }
		public string Path { get; private set; }
		public IExportContext ParentContext { get; }
		public string ProjectDirectory { get; }
		public string AssetsDirectory { get; }
		public string PackageJsonPath { get; }

		public bool Exists()
		{
			return File.Exists(PackageJsonPath);
		}

		public bool IsInstalled()
		{
			return ParentContext?.IsInstalled() ?? Directory.Exists(ProjectDirectory + "/node_modules");
		}

		public ITypeRegistry TypeRegistry { get; }
		public IDependencyRegistry DependencyRegistry { get; }
		public IExportSettings Settings { get; set; } = Engine.ExportSettings.Default;

		private readonly string fileExtension;

		public string GetExtension(Object obj)
		{
			return fileExtension ?? ParentContext?.GetExtension(obj) ?? ".glb";
		}

		public bool TryGetAssetDependencyInfo(Object obj, out IAssetDependencyInfo info)
		{
			if (ParentContext == null)
			{
				info = null;
				return false;
			}
			
			return ParentContext.TryGetAssetDependencyInfo(obj, out info);
		}

		public ObjectExportContext(IBuildContext buildContext, Object obj, string projectDirectory, string targetFilePath, string fileExtension = null, IExportContext parentContext = null)
		{
#if UNITY_EDITOR
			this.buildContext = buildContext;
			if (obj is GameObject go) Root = go.transform;
			else if (obj is Component comp) Root = comp.transform;
			else Debug.LogWarning(obj + " has no root", obj);
			ProjectDirectory = System.IO.Path.GetFullPath(projectDirectory);
			AssetsDirectory = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(targetFilePath));
			PackageJsonPath = ProjectDirectory + "/package.json";
			Path = targetFilePath;
			// TypesUtils.MarkDirty();
			TypeRegistry = new ReferenceRegistry(TypesUtils.GetTypes(this));
			DependencyRegistry = new DependencyRegistry(this);
			ParentContext = parentContext;
			this.fileExtension = fileExtension;
			if (parentContext != null) Id = ParentContext.Id;
			else Id = Random.Range(0, int.MaxValue);
#endif
		}
		
		private readonly IBuildContext buildContext;

		public IBuildContext BuildContext
		{
			get
			{
				if(this.buildContext != null) return this.buildContext;
				if(ParentContext is IHasBuildContext hasBuildContext) return hasBuildContext.BuildContext;
				return null;
			}
		}
	}
}