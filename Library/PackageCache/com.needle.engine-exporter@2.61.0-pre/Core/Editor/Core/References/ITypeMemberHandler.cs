using System;
using System.Reflection;

namespace Needle.Engine.Core.References
{
	public interface ITypeMemberHandler
	{
		bool ShouldIgnore(Type currentType, MemberInfo member);
		bool ShouldRename(MemberInfo member, out string newName);
		bool ChangeValue(MemberInfo member, Type type, ref object value, object instance);
	}

	public interface ITypeMemberHandlerLate
	{
		void PostRegisterField(MemberInfo member, Type type, ref object value, object instance, string path);
	}
}