using UnityEngine;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class LayerMaskResolver : IReferenceResolver
	{
		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result)
		{
			if (value is LayerMask mask)
			{
				result = mask.value.ToString();
				return true;
			}

			result = null;
			return false;
		}
	}
}