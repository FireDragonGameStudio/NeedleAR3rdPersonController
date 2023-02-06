using System;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class TransformExtensions
	{
		public static TransformData SaveTransform(this UnityEngine.Transform transform)
		{
			return new TransformData(transform.localPosition, transform.localScale, transform.localRotation);
		}

		public static void ApplyTransform(this Transform t, TransformData data)
		{
			t.localPosition = data.LocalPosition;
			t.localRotation = data.LocalRotation;
			t.localScale = data.LocalScale;
		}

		public static void SetLocalIdentity(this Transform t)
		{
			t.localPosition = Vector3.zero;
			t.localRotation = Quaternion.identity;
			t.localScale = Vector3.one;
		}
	}

	public struct TransformData
	{
		public Vector3 LocalPosition, LocalScale;
		public Quaternion LocalRotation;

		public TransformData(Vector3 localPosition, Vector3 localScale, Quaternion localRotation)
		{
			LocalPosition = localPosition;
			LocalScale = localScale;
			LocalRotation = localRotation;
		}
	}
	
	public readonly struct TransformExportScope : IDisposable
	{
		private readonly Transform t;
		private readonly TransformData data;

		public TransformExportScope(Transform t)
		{
			this.t = t;
			this.data = t.SaveTransform();
		}
		
		public void Dispose()
		{
			this.t.ApplyTransform(this.data);
		}
	}
}