using System;
using UnityEditor;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public class LabelWidthScope : IDisposable
	{
		private readonly float prev;

		public LabelWidthScope(float width)
		{
			prev = EditorGUIUtility.labelWidth;
			EditorGUIUtility.labelWidth = width;
		}

		public void Dispose()
		{
			EditorGUIUtility.labelWidth = prev;
		}
	}
}