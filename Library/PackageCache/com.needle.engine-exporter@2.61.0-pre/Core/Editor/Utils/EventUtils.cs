using System.Linq;
using System.Reflection;
using UnityEngine.Events;

namespace Needle.Engine.Utils
{
	public static class EventUtils
	{
		private static FieldInfo _persistentCallsField;
		private static FieldInfo persistentCallsField
		{
			get
			{
				_persistentCallsField ??=
					typeof(UnityEventBase).GetField("m_PersistentCalls", BindingFlags.Instance | BindingFlags.NonPublic);
				return _persistentCallsField; 
			}
		}


		public static bool TryFindCalls(this UnityEventBase evt, out CallInfo[] calls)
		{
			calls = null;
			if (evt == null) return false;
			var callsValue = persistentCallsField?.GetValue(evt);
			if (callsValue == null) return false;
			var callTuples = UnityEventAccess.EnumerateCalls(callsValue).ToArray();
			if (callTuples.Length > 0)
			{
				calls = new CallInfo[callTuples.Length];
				for (var i = 0; i < callTuples.Length; i++)
				{
					var t = callTuples[i];
					calls[i] = new CallInfo(t.target, t.methodName, t.state) { Argument = t.argument };
				}
			}
			return calls != null;
			// var list = calls.GetType().GetField("m_Calls", BindingFlags.Instance | BindingFlags.NonPublic)?.GetValue(calls) as IList;
			// // Debug.Log(list);
			// if (list == null) return;
			// foreach (var callInfo in list)
			// {
			// 	var type = callInfo.GetType();
			// 	var target = type.GetField("m_Target", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(callInfo) as Object;
			// 	var methodName = type.GetField("m_MethodName", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(callInfo);
			// 	var args = type.GetField("m_Arguments", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(callInfo);
			// 	Debug.Log(target?.name + "." + methodName + "(" + args + ")");
			// }
		}
	}
}