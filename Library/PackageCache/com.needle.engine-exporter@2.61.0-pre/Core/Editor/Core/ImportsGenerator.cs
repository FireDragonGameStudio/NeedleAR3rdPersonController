using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Needle.Engine.Core
{
	public class ImportsGenerator
	{
		private StringWriter writer;
		private bool didBegin = false;

		public void BeginWrite()
		{
			writer = new StringWriter(new StringBuilder());
			didBegin = true;
		}

		public void WriteTypes(IReadOnlyList<ImportInfo> types, string outputFilePath, string header = null)
		{
			if (!didBegin)
			{
				throw new Exception("Must call BeginWrite before and EndWrite after");
			}

			if (header != null)
			{
				writer.WriteLine("// " + header);
			}

			var written = new HashSet<string>();
			foreach (var file in types)
			{
				if (file.ShouldIgnore) continue;
				if (!file.IsInstalled) continue;
				var typename = file.TypeName;
				var typeIsAlreadyImported = false;
				if (written.Contains(typename))
				{
					typeIsAlreadyImported = true;
					Debug.LogWarning("Type " + typename + " was already imported, this may cause runtime problems. Ignored type: " + file.FilePath);
				}
				else written.Add(typename);
				var str = WriteImport(file, outputFilePath);
				if (str == null) continue;
				if (typeIsAlreadyImported) str = $"// {str} // type was already imported";
				writer.WriteLine(str);
			}
			writer.WriteLine("");
		}

		public void EndWrite(IReadOnlyList<ImportInfo> types, string outputFilePath)
		{
			writer.WriteLine("const out = {");
			writer.WriteLine("\t" + string.Join(",\n\t", types.Where(i => i.IsInstalled && !i.ShouldIgnore).Select(i => i.TypeName)));
			writer.WriteLine("};");
			writer.WriteLine("\n");
			writer.WriteLine("export { out as scripts }");
			File.WriteAllText(outputFilePath, writer.ToString());
			didBegin = false;
		}

		public static string WriteImport(ImportInfo file, string filePath, string importName = null)
		{
			// var path = file.FilePath;
			var relativePath = file.RelativeTo(filePath);
			var import = $"import {{ {file.TypeName}";
			if (importName != null && importName != file.TypeName)
			{
				import += $" as {importName}";
			}
			import += $" }} from \"{relativePath}\";";
			return import;
		}
	}
}