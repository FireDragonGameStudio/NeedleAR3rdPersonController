using UnityEngine;

namespace Needle.Engine.Core.Emitter
{
	public static class ThreeUtils
	{
		public static void InvertForward(this UnityEngine.Transform t)
		{
			var s = t.localRotation;
			s *= Quaternion.Euler(0, 180, 0);
			t.localRotation = s;
			var pos = t.localPosition;
			pos.x *= -1;
			t.localPosition = pos;
		}

		public static void WriteTransform(this UnityEngine.Transform transform, string variableName, IWriter writer)
		{
			var t = transform.transform;
			var p = t.localPosition;
			writer.Write($"{variableName}.position.set({p.x},{p.y},{p.z});");
			// rotation in gltf world
			var q = t.localRotation.ToGltfQuaternionConvert();
			// q *= Quaternion.Euler(-90, 0, 0);
			var rot = $"new THREE.Quaternion({q.x},{q.y},{q.z},{q.w})";
			writer.Write($"{variableName}.setRotationFromQuaternion({rot}); // " + q.eulerAngles);
			var s = t.localScale;
			writer.Write($"{variableName}.scale.set({s.x},{s.y},{s.z});");
		}

		public static void WriteVisible(string name, GameObject go, Component c, IWriter writer)
		{
			var visible = go.activeInHierarchy;
			if (c is Behaviour b && !b.enabled) visible = false;
			else if (c is Renderer r && !r.enabled) visible = false;
			if (!visible)
				writer.Write($"{name}.visible = false;");
		}


		// from UnityGLTF SchemaExtensions
		private static readonly Vector3 CoordinateSpaceConversionScale = new Vector3(-1, 1, 1);

		private static bool CoordinateSpaceConversionRequiresHandednessFlip => 
			CoordinateSpaceConversionScale.x * CoordinateSpaceConversionScale.y * CoordinateSpaceConversionScale.z < 0.0f;

		private static Quaternion ToGltfQuaternionConvert(this Quaternion q)
		{
			var fromAxisOfRotation = new Vector3(q.x, q.y, q.z);
			var axisFlipScale = CoordinateSpaceConversionRequiresHandednessFlip ? -1.0f : 1.0f;
			var toAxisOfRotation = axisFlipScale * Vector3.Scale(fromAxisOfRotation, CoordinateSpaceConversionScale);
			return new Quaternion(toAxisOfRotation.x, toAxisOfRotation.y, toAxisOfRotation.z, q.w);
		}
	}
}