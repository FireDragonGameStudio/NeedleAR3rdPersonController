using System.Reflection;

namespace Needle.Engine
{
	/// <summary>
	/// Called from contract resolver when using needle newtonsoft settings on serialization of a member
	/// </summary>
	public interface IValueResolver
	{
		bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value);
	}
}