using System;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class RectResolver : ITypeMemberHandler
	{
		[Serializable]
		public class SerializableRect
		{
			public float x, y, width, height;
		}

		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			if (value is Rect rect)
			{
				value = new SerializableRect()
				{
					x = rect.x, y = rect.y, width = rect.width, height = rect.height
				};
				return true;
			}
			return false;
		}
	}
}