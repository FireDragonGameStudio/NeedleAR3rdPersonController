using System.Collections.Generic;
using Needle.Engine.Utils;
using UnityEngine.EventSystems;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class EventTriggerResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection col, string path, object value, out string result)
		{
			if (value is EventTrigger.Entry entry)
			{
				result = $"{{ key : \"{entry.eventID.ToString()}\", callbacks: [";
				if (entry.callback.TryFindCalls(out var calls))
				{
					var results = new List<string>();
					foreach (var call in calls)
					{
						if (ReferenceResolver.TryResolveCall(resolver, col, path, call, out var res))
						{
							results.Add(res);
						}
					}
					result += string.Join(", ", results);
				}
				result += "]}";
				return true;
			}
			result = null;
			return false;
		}
	}
}