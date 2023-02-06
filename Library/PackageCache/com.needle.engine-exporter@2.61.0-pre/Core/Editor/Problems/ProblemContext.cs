#nullable enable
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;

namespace Needle.Engine.Problems
{
	public class ProblemContext
	{
		public readonly Dictionary<string, Task<ProblemFixResult>> RunningFixes = new Dictionary<string, Task<ProblemFixResult>>();
		public readonly string ProjectDirectory;
		public readonly IList<Dependency>? SerializedDependencies;

		public ProblemContext(string projectDirectory)
		{
			var info = Object.FindObjectOfType<ExportInfo>();
			SerializedDependencies = null;
			if (info)
				SerializedDependencies = info.Dependencies;
			this.ProjectDirectory = Path.GetFullPath(projectDirectory);
		}
	}
}