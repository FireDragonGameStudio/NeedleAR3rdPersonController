using System;
using System.IO;

namespace Needle.Engine
{
	public class NeedleLock : IDisposable
	{
		private readonly string path;
		private readonly string id;
		
		public NeedleLock(string projectDirectory)
		{
			if (projectDirectory == null)
				return;
			projectDirectory = Path.GetFullPath(projectDirectory);
			if (!Directory.Exists(projectDirectory)) return;
			path = Path.Combine(projectDirectory, "needle.lock");
			id = DateTimeOffset.Now.ToUnixTimeMilliseconds().ToString();
			File.WriteAllText(path, id);
		}
		
		public void Dispose()
		{
			if (id == null) return;
			if (!File.Exists(path)) return;
			var text = File.ReadAllText(path);
			if (text == id) File.Delete(path);
		}
	}
}