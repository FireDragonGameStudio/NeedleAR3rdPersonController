using Needle.Engine.Core;
using UnityEngine;

namespace Needle.Engine.Interfaces
{
	/// <summary>
	/// Invoked during scene processing. Used to produce javascript code that produces the current scene
	/// </summary>
	public interface IEmitter
	{
		ExportResultInfo Run(Component comp, ExportContext context);
	}
}