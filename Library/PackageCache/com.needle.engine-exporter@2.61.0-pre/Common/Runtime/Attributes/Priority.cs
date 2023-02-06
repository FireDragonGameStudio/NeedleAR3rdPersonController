using System;

namespace Needle.Engine
{
	[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct)]
	public class Priority : Attribute
	{
		public readonly int Value;

		public Priority(int value)
		{
			Value = value;
		}
	}
}