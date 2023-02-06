using System.Reflection;
using JetBrains.Annotations;
using UnityEditor;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	[UsedImplicitly]
	public class AssetReferenceExporter : GltfExtensionHandlerBase
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			context.RegisterValueResolver(new AssetReferenceResolver());
		}

		private class AssetReferenceResolver : IValueResolver
		{
			public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
			{
				if (value is Object obj && EditorUtility.IsPersistent(obj))
				{
					if (Export.AsGlb(ctx, obj, out var path, instance))
					{
						value = path;
						return true;
					}
				}
				return false;
			}
		}
	}

}