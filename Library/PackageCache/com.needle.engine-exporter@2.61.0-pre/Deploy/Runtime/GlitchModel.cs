using System;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Deployment
{
	[Serializable]
	public class GlitchModel : ScriptableObject
	{
		public string ProjectName;
#if UNITY_EDITOR
		[NonSerialized]
		public SerializedObject serializedObject;

		public bool IsValidProjectName()
		{
			return !string.IsNullOrWhiteSpace(ProjectName) && !ProjectName.Contains("/");
		}
#endif
	}
}