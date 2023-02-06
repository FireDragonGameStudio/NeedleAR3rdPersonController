using System.Security.Policy;
using Needle.Engine.Settings;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Windows;

namespace Needle.Engine.Core
{
	public class ExportContext : IExportContext, IHasBuildContext
	{
		public readonly string Hash;
		public Transform Root { get; set; }
		public IExportSettings ExportSettings { get; set; }
		public int Id { get; }
		public string Path { get; }
		public IExportContext ParentContext { get; }
		
		public BuildContext BuildContext;
		IBuildContext IHasBuildContext.BuildContext => this.BuildContext;
		
		public readonly ProjectInfo Project;
		public ICodeWriter Writer { get; }
		public IReferenceRegistry References { get; }
		public ITypeRegistry TypeRegistry { get; }

		public IDependencyRegistry DependencyRegistry { get; }
		public IExportSettings Settings { get; set; } = Engine.ExportSettings.Default;

		private const string defaultExtension = ".glb";

		public string GetExtension(Object obj) => defaultExtension;

		// public readonly IReadOnlyList<ImportInfo> KnownScripts;
		public GameObject GameObject;
		public Component Component;
		public string ParentName;
		public string VariableName;
		public bool Cancelled = false;

		public bool IsExported, IsInGltf, ObjectCreated;

		public ExportContext(string path, string hash, BuildContext buildContext, ProjectInfo project, ICodeWriter writer, IReferenceRegistry references, ITypeRegistry types, IExportContext parent)
		{
			this.Id = Random.Range(0, int.MaxValue);
			this.Path = path;
			this.Hash = hash;
			this.ParentContext = parent;
			this.BuildContext = buildContext;
			Project = project;
			Writer = writer;
			References = references;
			TypeRegistry = types;
		}

		internal void Reset()
		{
			ParentName = "scene";
			IsExported = false;
			IsInGltf = false;
			ObjectCreated = false;
		}

		public string ProjectDirectory => Project.ProjectDirectory;
		public string AssetsDirectory => Project.AssetsDirectory;
		public string PackageJsonPath => Project.PackageJsonPath;
		
		public bool Exists()
		{
			return Project.Exists();
		}

		public bool IsInstalled()
		{
			return Project.IsInstalled();
		}


		
		private AssetDependencyHandler handler;
		
		public bool TryGetAssetDependencyInfo(Object obj, out IAssetDependencyInfo info)
		{
			if (ExporterProjectSettings.instance.smartExport)
			{
				handler ??= new AssetDependencyHandler();

				if (handler.TryGetDependency(obj, out var dep))
				{
					info = dep;
					return true;
				}
			}

			info = null;
			return false;
		}

		public void Dispose()
		{
			handler?.WriteCache();
		}

	}
}