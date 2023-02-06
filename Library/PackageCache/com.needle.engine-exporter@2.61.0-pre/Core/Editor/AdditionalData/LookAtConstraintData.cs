using System.Collections.Generic;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEngine.Animations;

namespace Needle.Engine.AdditionalData
{
	public class LookAtConstraintData : IAdditionalDataProvider
	{
		public void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData)
		{
			if (instance is LookAtConstraint look && look.sourceCount > 0)
			{
				var sources = new List<ConstraintSource>();
				look.GetSources(sources);
				var guids = new List<JObject>();
				foreach (var source in sources)
				{
					guids.Add(new JObject(){{"guid", source.sourceTransform.GetId()}});
				}
				additionalData.Add(("sources", guids));
			}
		}
	}
}