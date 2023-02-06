/*

using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Core.Emitter
{
	[Priority(-1000)]
	public class TransformEmitter : IEmitter
	{
		public ExportResultInfo Run(Component comp, ExportContext context)
		{
			if (context.ObjectCreated || context.IsInGltf) return ExportResultInfo.Failed;
			if (comp is Transform t)
			{
				// Debug.Log(comp.gameObject.name + ": " + context.ObjectCreated);
				var name = context.VariableName;
				var writer = context.Writer;
				writer.Write($"const {name} = new THREE.Object3D();");
				writer.Write($"{name}.name = \"{t.name}\";");
				writer.Write($"{name}.guid = \"{comp.GetId()}\";");
				using (new TransformExportScope(t))
				{
					var pos = t.localPosition;
					pos.x *= -1;
					t.localPosition = pos;
					t.WriteTransform(name, context.Writer);
				}
				writer.Write($"{context.ParentName}.add({name});");
				// context.ParentName = name;
				return new ExportResultInfo(name, false);
			}
			return ExportResultInfo.Failed;
		}
	}
}

*/