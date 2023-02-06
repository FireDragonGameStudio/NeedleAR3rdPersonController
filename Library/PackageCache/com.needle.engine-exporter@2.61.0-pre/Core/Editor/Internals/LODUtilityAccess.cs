#if UNITY_EDITOR

using UnityEditor;
using UnityEngine;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public static class LODUtilityAccess
	{
		public static float CalculateDistance(Camera camera, float relativeScreenHeight, LODGroup group)
		{
			return LODUtility.CalculateDistance(camera, relativeScreenHeight, group);
		}
	}
}

#endif