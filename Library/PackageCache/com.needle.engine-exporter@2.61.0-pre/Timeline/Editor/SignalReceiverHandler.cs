using System;
using System.Collections.Generic;
using System.Reflection;
using Needle.Engine.Core;
using Needle.Engine.Core.References;
using Needle.Engine.Gltf;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using UnityEngine.Timeline;

namespace Needle.Engine.Timeline
{
	public class SignalReceiverHandler : ITypeMemberHandler, IRequireExportContext
	{
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			if (member.DeclaringType == typeof(SignalReceiver))
			{
				if (member.Name == "m_Events")
				{
					newName = fieldName;
					return true;
				}
			}
			newName = null;
			return false;
		}

		private const string fieldName = "events";
		private static FieldInfo signalReceiverEventsField;

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			if (instance is SignalReceiver receiver)
			{
				switch (member.Name)
				{
					case "m_Events":
						var eventsList = new List<SignalReceiverModel>();
						value = eventsList;
						for (var i = 0; i < receiver.Count(); i++)
						{
							var signal = receiver.GetSignalAssetAtIndex(i);
							var evt = receiver.GetReaction(signal);
							var model = new SignalReceiverModel();
							model.signal = new SignalAssetModel(signal);
							eventsList.Add(model);
							if (evt.TryFindCalls(out var calls))
							{
								if (Context is GltfExportContext)
								{
									var reaction = new SignalReactionModel();
									model.reaction = reaction;
									reaction.calls = new List<SignalCall>();
									foreach (var call in calls)
									{
										var callModel = new SignalCall();
										callModel.target = call.Target.GetId();
										callModel.method = call.MethodName;
										reaction.calls.Add(callModel);
									}
								}
							}
						}
						return true;
				}
			}

			return false;
		}

		public IExportContext Context { get; set; }
	}

	[Serializable]
	public class SignalReceiverModel
	{
		public SignalAssetModel signal;
		public SignalReactionModel reaction;
		// 
		// [NonSerialized, JsonIgnore]
		// public UnityEvent reaction;
	}

	[Serializable]
	public class SignalReactionModel
	{
		public string type = "EventList";
		public IList<SignalCall> calls;
	}

	[Serializable]
	public class SignalCall
	{
		public string target;
		public string method;
	}
}