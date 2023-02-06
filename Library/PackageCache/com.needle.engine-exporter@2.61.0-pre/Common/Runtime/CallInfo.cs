#nullable enable

using UnityEngine;
using UnityEngine.Events;

namespace Needle.Engine
{
	public class CallInfo
	{
		public Object Target;
		public string MethodName;
		public object? Argument;
		public UnityEventCallState State;

		public CallInfo(Object target, string methodName, UnityEventCallState state)
		{
			Target = target;
			MethodName = methodName;
			State = state;
		}

		public override string ToString()
		{
			return Target + "." + MethodName + "(" + Argument + ")";
		}
	}

}