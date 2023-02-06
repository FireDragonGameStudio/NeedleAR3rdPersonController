using System;

namespace Needle.Engine
{
	public class AbortExportException : Exception
	{
		public AbortExportException(string msg) : base(msg)
		{
			
		}
	}
}