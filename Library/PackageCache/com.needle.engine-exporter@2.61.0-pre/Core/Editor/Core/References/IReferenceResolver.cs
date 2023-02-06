namespace Needle.Engine.Core.References
{
	public interface IReferenceResolver
	{
		bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result);
	}
}