using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Animations;

namespace Needle.Engine.Core.References.TypeRegisterHandler
{
	[Priority(0)]
	public class LookAtConstraintHandler : DefaultTypeMemberRegisterHandler
	{
		public override bool TryRegister(ReferenceRegistry reg, ReferenceCollection collection, string path, Component instance, Type type)
		{
			if (instance is LookAtConstraint look)
			{
				var res = base.TryRegister(reg, collection, path, instance, type);
				if (!res) return false;
				var sources = new List<ConstraintSource>();
				look.GetSources(sources);
				reg.RegisterField(path, instance, "sources", sources.Select(s => s.sourceTransform).ToArray());
				return true;
			}
			return false;
		}
	}
}