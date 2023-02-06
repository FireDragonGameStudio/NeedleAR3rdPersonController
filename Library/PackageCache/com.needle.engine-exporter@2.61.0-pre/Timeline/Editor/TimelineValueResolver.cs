using System.Collections.Generic;
using System.Reflection;
using Needle.Engine.Core;
using Needle.Engine.Utils;
using UnityEngine.Timeline;

namespace Needle.Engine.Timeline
{
	internal class TimelineValueResolver : IValueResolver
	{
		public readonly PlayableDirectorExportContext context;

		public TimelineValueResolver(PlayableDirectorExportContext directorExport)
		{
			this.context = directorExport;
		}

		public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
		{
			if (value is TimelineAsset asset)
			{
				if (context.Director.playableAsset == asset)
				{
					if (TimelineSerializer.TryExportPlayableAsset(context, asset, out var res))
					{
						value = res;
						return true;
					}
				}
			}
				
			if (value is SignalAsset signal)
			{
				value = new SignalAssetModel(signal);
				return true;
			}

			if (instance is SignalReceiver receiver)
			{
				switch (member.Name)
				{
					case "m_Events":
						var eventsList = new List<SignalReceiverModel>();
						value = eventsList;
						for (var i = 0; i < receiver.Count(); i++)
						{
							var sig = receiver.GetSignalAssetAtIndex(i);
							var evt = receiver.GetReaction(sig);
							var model = new SignalReceiverModel();
							model.signal = new SignalAssetModel(sig);
							eventsList.Add(model);
							if (evt.TryFindCalls(out var calls))
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
						return true;
				}
			}
				
			return false;
		}
	}
}