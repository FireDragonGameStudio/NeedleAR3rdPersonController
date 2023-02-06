#nullable enable

using System;
using System.Collections.Generic;

namespace Needle.Engine
{
	[Serializable]
	public struct DependencyInfo
	{
		public string uri;
		public long fileSize;
		
		/// <summary>
		/// other external/nested gltfs that reference this uri
		/// </summary>
		public List<string>? referencedBy;

		public DependencyInfo(DependencyInfo other)
		{
			this.uri = other.uri;
			this.fileSize = other.fileSize;
			if (other.referencedBy != null)
				this.referencedBy = new List<string>(other.referencedBy);
			else this.referencedBy = null;
		}
	}

	/// <summary>
	/// Used to track dependencies to external assets of gltf files
	/// </summary>
	public interface IDependencyRegistry
	{
		int Count { get; }
		IReadOnlyCollection<DependencyInfo> Dependencies { get; }
		IReadOnlyList<IExportContext> Contexts { get; }
		void RegisterDependency(string uri, string source, IExportContext context);
		IEnumerable<DependencyInfo> GetRelativeTo(string basePath);
	}
}