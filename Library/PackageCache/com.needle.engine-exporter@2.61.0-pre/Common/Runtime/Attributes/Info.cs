using System;
using UnityEngine;

namespace Needle.Engine
{
	[AttributeUsage(AttributeTargets.Field, AllowMultiple = true, Inherited = true)]
	public class InfoAttribute : PropertyAttribute
	{
		public enum InfoType
		{
			None,
			Info,
			Warning,
			Error,
		}

		public string message;
		public InfoType type;

		public InfoAttribute(string message, InfoType type = InfoType.None)
		{
			this.message = message;
			this.type = type;
		}
	}
}