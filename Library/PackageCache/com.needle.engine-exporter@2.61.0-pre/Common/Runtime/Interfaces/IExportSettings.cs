using System.Collections.Generic;

namespace Needle.Engine
{
	public interface IExportSettings
	{
		bool IsExtensionAllowed(string name);
		void SetExtensionAllowed(string name, bool allowed);
		bool ExportSkybox { get; set; }
		IExportSettings Clone();
	}

	public struct ExportSettings : IExportSettings
	{
		public static ExportSettings Default => new ExportSettings() { ExportSkybox = true };
		
		private List<string> ignoredExtensions;

		public bool IsExtensionAllowed(string name)
		{
			return ignoredExtensions == null || !ignoredExtensions.Contains(name);
		}

		public void SetExtensionAllowed(string name, bool allowed)
		{
			if (!allowed)
			{
				if(ignoredExtensions == null) ignoredExtensions = new List<string>();
				ignoredExtensions.Add(name);
			}
			else ignoredExtensions?.RemoveAll(e => e == name);
		}

		public bool ExportSkybox { get; set; }

		public IExportSettings Clone()
		{
			var clone = new ExportSettings()
			{
				ExportSkybox = ExportSkybox
			};
			if (this.ignoredExtensions != null)
				clone.ignoredExtensions = ignoredExtensions;
			return clone;
		}
	}
}