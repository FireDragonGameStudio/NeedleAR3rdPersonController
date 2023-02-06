using System;
using System.Linq;
using System.Reflection;
using UnityEngine.Animations;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class LookConstraintMembers : ITypeMemberHandler
	{
		private readonly string[] members = new[] { "constraintActive", "locked" };
		
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (member.DeclaringType != typeof(LookAtConstraint)) return false;
			return !members.Contains(member.Name);
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			// if (member.DeclaringType == typeof(LookAtConstraint))
			// {
			// 	if (member.Name == "transform")
			// 	{
			// 		newName = "target";
			// 		return true;
			// 	}
			// }
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			return false;
		}
	}
}