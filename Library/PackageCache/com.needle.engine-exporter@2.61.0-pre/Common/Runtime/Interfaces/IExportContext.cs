#nullable enable

using UnityEngine;

namespace Needle.Engine
{
	public interface IExportContext : IProjectInfo
	{
		public int Id { get; }
		public string Path { get; }
		/// <summary>
		/// The object that is being exported
		/// </summary>
		public Transform Root { get; }
		IExportContext? ParentContext { get; }
		ITypeRegistry TypeRegistry { get; }
		IDependencyRegistry DependencyRegistry { get; }
		IExportSettings Settings { get; set; }
		string GetExtension(Object obj);
		bool TryGetAssetDependencyInfo(Object obj, out IAssetDependencyInfo info);
	}
}