using System;
using System.Globalization;

namespace Needle.Engine.Writer
{
	/// <summary>
	/// set invariant locale so all strings export properly (e.g. . instead of ,)
	/// </summary>
	public class CultureScope : IDisposable
	{
		private readonly CultureInfo culture;

		public CultureScope() : this(CultureInfo.InvariantCulture) { }
		
		public CultureScope(CultureInfo info)
		{
			culture = System.Threading.Thread.CurrentThread.CurrentCulture;
			System.Threading.Thread.CurrentThread.CurrentCulture = info;
		}
		
		public void Dispose()
		{
			System.Threading.Thread.CurrentThread.CurrentCulture = culture;
		}
	}
}