using System;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class AnimatorMembers : ITypeMemberHandler
	{
		private static readonly string[] include = new[]
		{
			"applyRootMotion",
			"hasRootMotion",
			"keepAnimatorControllerStateOnDisable",
			"runtimeAnimatorController",
			"speed",
			"normalizedStartOffset",
		};
		
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (currentType != typeof(Animator)) return false;
			for (var index = 0; index < include.Length; index++)
			{
				var i = include[index];
				if (i == member.Name) return false;
			}
			return true;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			return false;
		}
		
		// private static readonly string[] ignore = new[]
		// {
		// 	// "applyRootMotion",
		// 	"targetPosition",
		// 	"targetRotation",
		// 	"deltaPosition",
		// 	"deltaRotation",
		// 	"velocity",
		// 	"angularVelocity",
		// 	"rootPosition",
		// 	"rootRotation",
		// 	"updateMode",
		// 	"isInitialized",
		// 	"isOptimizable",
		// 	// "isHuman",
		// 	// "hasRootMotion",
		// 	"bodyPosition",
		// 	"bodyRotation",
		// 	// "pivotPosition",
		// 	"feetPivotActive",
		// 	"parameterCount",
		// 	"parameters",
		// 	"layerCount",
		// 	"stabilizeFeet",
		// 	"avatar",
		// 	"hasBoundPlanes",
		// 	"hasBoundPlayables",
		// 	"playableGraph",
		// 	"recorderMode",
		// 	"playbackTime",
		// 	"recorderStartTime",
		// 	"recorderStopTime",
		// 	"layersAffectMassCenter",
		// 	"logWarnings"
		// };
	}
}