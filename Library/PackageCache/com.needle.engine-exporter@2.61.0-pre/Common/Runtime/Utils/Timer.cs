using System;
using System.Diagnostics;
using Debug = UnityEngine.Debug;
using Object = UnityEngine.Object;

namespace Needle.Engine.Utils
{
	public readonly struct Timer : IDisposable
	{
		public readonly string Message;
		public readonly Object Context;
		
		private readonly Stopwatch watch;

		public Timer(string message, Object context = null)
		{
			this.Message = message;
			this.Context = context;
			watch = new Stopwatch();
			watch.Start();
		}

		public Timer Begin()
		{
			if (watch == null) return this;
			watch.Reset();
			watch.Start();
			return this;
		}
		
		public void Dispose()
		{
			if (watch != null)
			{
				watch.Stop();
				// Debug.Log($"{Message}: {watch.Elapsed.TotalMilliseconds:0} ms", Context);
			}
		}
	}
}