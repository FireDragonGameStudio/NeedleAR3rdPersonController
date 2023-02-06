using System;
using System.IO;

namespace Needle.Engine
{
	public class ImportInfo : IImportedTypeInfo
	{
		public string TypeName { get; }
		public string FilePath { get; }
		public bool IsInstalled { get; set; } = true;
		public FileInfo PackageJson { get; }
		// public bool IsInstalled = true;

		private readonly string fileContent;

		public ImportInfo(string typename, string filepath, string content, FileInfo packageJson)
		{
			this.TypeName = typename;
			this.FilePath = Path.GetFullPath(filepath);
			this.fileContent = content;
			this.PackageJson = packageJson;
		}

		public string RelativeTo(string directory)
		{
			try
			{
				return new Uri(directory).MakeRelativeUri(new Uri(FilePath)).ToString().Replace("%20", " ");
			}
			catch (UriFormatException)
			{
				return FilePath;
			}
		}

		public bool ShouldIgnore => FilePath.StartsWith("__");
	}
}