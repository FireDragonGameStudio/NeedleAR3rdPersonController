using System.IO;
using System.Text;
using Needle.Engine.Core.References;

namespace Needle.Engine.Writer
{
	public class CodeWriter : ICodeWriter
	{
		private readonly StringBuilder builder;
		private string filePath;

		public CodeWriter(string filePath = null)
		{
			builder = new StringBuilder();
			this.filePath = filePath;
		}

		public void Clear() => builder.Clear();

		public void Write(string str)
		{
			for (var i = 0; i < Indentation; i++)
				builder.Append("\t");
			builder.AppendLine(str);
		}

		public string FilePath
		{
			get => filePath;
			set => filePath = value;
		}

		public string Flush()
		{
			var content = builder.ToString();
			if (!string.IsNullOrWhiteSpace(filePath))
			{
				if (File.Exists(filePath)) 
					File.Delete(filePath);
				// write
				using (new CultureScope())
					File.WriteAllText(filePath, content, Encoding.UTF8);
			}
			builder.Clear();
			return content;
		}

		public int Indentation { get; set; }
	}

	public static class CodeWriterExtensions
	{
		public static void BeginBlock(this ICodeWriter writer)
		{
			writer.Write("{");
			writer.Indentation += 1;
		}

		public static void EndBlock(this ICodeWriter writer, string postfix = null)
		{
			writer.Indentation -= 1;
			writer.Write($"}}{postfix}");
		}

		public static string ToVariableName(this string str)
		{
			return str.ToJsVariable();
		}
	}
}