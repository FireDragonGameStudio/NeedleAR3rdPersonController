using System;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class GameObjectMember : ITypeMemberHandler
	{
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (typeof(Component).IsAssignableFrom(member.DeclaringType))
			{
				// ignore gameobject field because it would result in duplicate code,
				// we use the transform field and rename it to gameobject
				if (member.Name == "gameObject")
				{
					return true;
				}
			}
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			if (typeof(Component).IsAssignableFrom(member.DeclaringType))
			{
				if (member.Name == "transform")
				{
					newName = "gameObject";
					return true;
				}
			}
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			return false;
		}
	}
}