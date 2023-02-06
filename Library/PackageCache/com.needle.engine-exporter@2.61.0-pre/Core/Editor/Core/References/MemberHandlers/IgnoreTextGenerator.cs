using System;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class IgnoreTextGenerator : ITypeMemberHandler
	{
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (typeof(TextGenerator).IsAssignableFrom(currentType))
			{
				return true;
			}
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			return false;
		}
		
	}
}