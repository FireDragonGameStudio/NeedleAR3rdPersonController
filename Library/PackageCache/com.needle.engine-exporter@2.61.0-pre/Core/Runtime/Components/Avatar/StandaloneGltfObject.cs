using System;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Components
{
	[Obsolete]
	[HelpURL(Constants.DocumentationUrl)]
	public class StandaloneGltfObject : GltfObject
	{
		public override bool Export(string path, bool force, IExportContext context)
		{
			var t = this.transform;
			using (new TransformExportScope(t))
			{
				t.position = Vector3.zero;
				t.rotation = Quaternion.identity;
				t.localScale = Vector3.one;
				return base.Export(path, force, context);
			}
		}
	}
}