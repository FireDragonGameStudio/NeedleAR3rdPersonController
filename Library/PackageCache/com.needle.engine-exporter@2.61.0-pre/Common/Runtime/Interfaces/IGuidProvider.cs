using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine
{
	public interface IGuidProvider
	{
		string GetGuid(Object obj);
	}

	public class DefaultGuidProvider : IGuidProvider
	{
		public string GetGuid(Object obj)
		{
			return obj.GetId();
		}
	}
}