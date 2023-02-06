using System;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class ColliderMembers : ITypeMemberHandler 
	{
		private static readonly string[] include = new[]
		{
			"attachedRigidbody",
			"isTrigger",
			"sharedMaterial",
			"radius",
			"center",
			"size",
			"sharedMesh",
			"convex",
			"height",
		};
		
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (!typeof(Collider).IsAssignableFrom(currentType)) return false;
			
			if (include.Contains(member.Name)) return false;
			return true;
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