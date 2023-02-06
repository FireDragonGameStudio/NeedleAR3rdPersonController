using System;
using System.Reflection;
using System.Threading.Tasks;
using Needle.Engine.Interfaces;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class RigidbodySettings : ITypeMemberHandler, IBuildStageCallbacks
	{
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			if (member.DeclaringType == typeof(Rigidbody) && member.Name == "sleepThreshold" && value is float)
			{
				const float warnThreshold = 0.1f;
				if (Math.Abs((float)value - 0.005f) < 0.00001f)
				{
					value = Physics.sleepThreshold;
					if (!didWarn_physicsSleepThresholdIsVeryLow && (float)value <= warnThreshold)
					{
						didWarn_physicsSleepThresholdIsVeryLow = true;
						Debug.LogWarning("Physics sleep threshold is very low: " + value + ". This can cause performance issues.");
					}
				}
				else
				{
					if ((float)value <= warnThreshold)
					{
						Debug.LogWarning("Sleep threshold is too low: " + value + ". This can cause performance issues.", instance as Object);
					}
				}
				return true;
			}

			return false;
		}

		private bool didWarn_physicsSleepThresholdIsVeryLow = false;
		
		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			if (stage == BuildStage.PreBuildScene)
			{
				didWarn_physicsSleepThresholdIsVeryLow = false;
			}
			return Task.FromResult(true);
		}
	}
}