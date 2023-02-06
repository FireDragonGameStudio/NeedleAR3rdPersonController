using System.Collections.Generic;
using System.IO;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	public class DependencyRegistry : IDependencyRegistry
	{
		public int Count => dependencyInfos.Count;
		public IReadOnlyCollection<DependencyInfo> Dependencies => dependencyInfos.Values;
		public IReadOnlyList<IExportContext> Contexts => registeredContexts;

		private readonly IExportContext context;
		private readonly List<IExportContext> registeredContexts = new List<IExportContext>();

		public DependencyRegistry(IExportContext context)
		{
			this.context = context;
		}

		private readonly Dictionary<string, DependencyInfo> dependencyInfos = new Dictionary<string, DependencyInfo>();

		public void RegisterDependency(string uri, string source, IExportContext context)
		{
			if (!registeredContexts.Contains(context))
				registeredContexts.Add(context);
			
			// register the chain up (so the root object knows about the nested gltf dependencies as well)
			this.context.ParentContext?.DependencyRegistry?.RegisterDependency(uri, source, this.context);

			uri = Path.GetFullPath(uri);
			source = Path.GetFullPath(source);
			if (source != uri)
			{
				var depPath = source.RelativeTo(Path.GetFullPath(context.Path));
				if (dependencyInfos.TryGetValue(uri, out var dep))
				{
					if (!string.IsNullOrWhiteSpace(depPath))
					{
						dep.referencedBy ??= new List<string>();
						dep.referencedBy.Add(depPath);
					}
					dependencyInfos[uri] = dep;
					return;
				}
				
				dep = new DependencyInfo();
				dep.uri = uri;
				if (!string.IsNullOrWhiteSpace(depPath))
					dep.referencedBy = new List<string> {depPath};
				dependencyInfos.Add(uri, dep);
			}
		}

		public IEnumerable<DependencyInfo> GetRelativeTo(string basePath)
		{
			Debug.Assert(!string.IsNullOrEmpty(basePath));
			// var baseUri = new Uri(basePath);
			foreach (var dep in Dependencies)
			{
				var copy = new DependencyInfo(dep);
				copy.uri = PathUtils.MakeRelative(basePath, dep.uri, false);
				if (string.IsNullOrWhiteSpace(copy.uri))
				{
					continue;
				}

				if (copy.fileSize == 0)
				{
					var fi = new FileInfo(dep.uri);
					copy.fileSize = fi.Exists ? fi.Length : -1;
				}

				yield return copy;
			}
		}
	}
}