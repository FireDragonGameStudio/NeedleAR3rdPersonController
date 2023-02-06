using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class EditorContextUtils
	{
		public static void CreateContextMenuForLastRect(Action<GenericMenu> onOpen)
		{
			if (Event.current.type == EventType.ContextClick)
			{
				var last = GUILayoutUtility.GetLastRect();
				if (last.Contains(Event.current.mousePosition))
				{
					var m = new GenericMenu();
					onOpen?.Invoke(m);
					if (m.GetItemCount() > 0)
						m.ShowAsContext();
				}
			}
		}
	}
}