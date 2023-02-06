#nullable enable

namespace Needle.Engine.Core
{
	public readonly struct ExportResultInfo
	{
		public readonly bool Success;
		public readonly string? Path;
		public readonly bool HierarchyExported;

		public ExportResultInfo(string? path, bool hierarchyExported, bool success = true)
		{
			Path = path;
			HierarchyExported = hierarchyExported;
			Success = success;
		}

		public static implicit operator bool(ExportResultInfo info)
		{
			return info.Success;
		}

		public static ExportResultInfo Failed => new ExportResultInfo();
	}
}