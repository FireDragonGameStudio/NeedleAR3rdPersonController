using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Needle.Engine.Core.References.TypeRegisterHandler
{
	public class EventTriggerHandler : ITypeMemberRegisterHandler
	{
		public bool TryRegister(ReferenceRegistry reg, ReferenceCollection collection, string path, Component instance, Type type)
		{
			if (instance is EventTrigger tr)
			{
				
			}
			return false;
		}
	}
}