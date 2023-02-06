using System;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class CameraMembers : ITypeMemberHandler
	{
		private readonly string[] allowList = new[]
		{
			"fieldOfView",
			"aspect",
			"nearClipPlane",
			"farClipPlane",
			"clearFlags",
			"ortographic",
			"ortographicSize",
			"ARBackgrounAlpha",
			"backgroundColor",
			"cullingMask",
		};
		
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (typeof(Camera).IsAssignableFrom(currentType))
			{
				var isInAllowList = allowList.Any(m => m.IndexOf(member.Name, StringComparison.OrdinalIgnoreCase) >= 0);
				return !isInAllowList;
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