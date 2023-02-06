using System;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class ReflectionProbeMembers : ITypeMemberHandler
	{
		private static readonly string[] reflectionProbeMembers = {
			"texture",
			"center",
			"size",
		};
		
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (typeof(ReflectionProbe).IsAssignableFrom(member.DeclaringType))
			{
				if (reflectionProbeMembers.Any(m => m.Equals(member.Name)))
					return false;
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