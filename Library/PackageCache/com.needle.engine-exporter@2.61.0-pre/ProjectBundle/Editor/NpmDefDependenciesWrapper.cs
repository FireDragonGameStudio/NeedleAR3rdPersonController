using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	/// <summary>
	/// Only used to display an editor list
	/// </summary>
	internal class NpmDefDependenciesWrapper : ScriptableObject
	{
		[NonReorderable] // because drop in 2022.1 is not raising change evt
		public List<NpmDefObject> Dependencies = new List<NpmDefObject>();
	}
}