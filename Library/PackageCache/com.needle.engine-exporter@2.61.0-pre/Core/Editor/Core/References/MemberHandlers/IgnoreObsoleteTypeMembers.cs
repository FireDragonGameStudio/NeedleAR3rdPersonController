using System;
using System.Collections.Generic;
using System.Reflection;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class IgnoreObsoleteTypeMembers : ITypeMemberHandler
	{
		private static readonly Dictionary<MemberInfo, bool> ignore = new Dictionary<MemberInfo, bool>();

		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (ignore.TryGetValue(member, out var res)) return res;
			
			var attr = member.GetCustomAttribute<ObsoleteAttribute>();
			ignore.Add(member, attr != null);
			return attr != null;
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