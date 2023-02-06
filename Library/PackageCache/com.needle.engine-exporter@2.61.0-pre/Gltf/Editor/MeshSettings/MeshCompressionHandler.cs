using System;
using System.Collections.Generic;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Gltf
{
	public class MeshCompressionHandler : GltfExtensionHandlerBase
	{
		public override void OnAfterMeshExport(GltfExportContext context, Mesh mesh, List<object> extensions)
		{
			base.OnAfterMeshExport(context, mesh, extensions);

			if (NeedleAssetSettingsProvider.TryGetMeshSettings(mesh, out var settings))
			{
				if (settings.@override)
				{
					var ext = new NEEDLE_mesh_compression();
					ext.useSimplifier = true;
					ext.error = settings.error;
					ext.ratio = settings.ratio;
					ext.lockBorder = settings.lockBorder;
					extensions.Add(ext);
					return;
				}
			}
			
			
			var labels = AssetDatabase.GetLabels(mesh);
			foreach (var label in labels)
			{
				if (label.Equals("simplify", StringComparison.OrdinalIgnoreCase))
				{
					var ext = new NEEDLE_mesh_compression();
					ext.useSimplifier = true;
					extensions.Add(ext);
				}
			}
		}
	}
}