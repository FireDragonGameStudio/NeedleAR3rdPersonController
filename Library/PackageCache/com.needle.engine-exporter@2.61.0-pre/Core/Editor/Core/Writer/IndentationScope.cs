using System;

namespace Needle.Engine.Core.Writer
{
	public readonly struct IndentationScope : IDisposable
	{
		private readonly ICodeWriter writer;
		private readonly int level;

		public IndentationScope(ICodeWriter wr, uint level = 1)
		{
			this.writer = wr;
			this.level = (int)level;
			wr.Indentation += this.level;
		}

		public void Dispose()
		{
			writer.Indentation -= this.level;
		}
	}
}