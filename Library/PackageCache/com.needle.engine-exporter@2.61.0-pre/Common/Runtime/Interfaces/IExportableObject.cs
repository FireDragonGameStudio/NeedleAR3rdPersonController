using UnityEngine;

namespace Needle.Engine
{
	public interface IExportableObject
	{
		string name { get; }
		bool Export(string path, bool force, IExportContext context);
	}

	public interface IHasSmartExport
	{
		bool SmartExportEnabled { get; }
		bool IsDirty { get; }
	}

	public interface IExportableObjectEvents
	{
		void OnSceneObjectChanged(Object obj);
	}
}