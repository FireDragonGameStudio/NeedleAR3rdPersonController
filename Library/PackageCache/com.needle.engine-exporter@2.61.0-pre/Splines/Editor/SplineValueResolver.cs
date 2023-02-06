#if SPLINES_INSTALLED
using System.Collections.Generic;
using System.Reflection;
using JetBrains.Annotations;
using Needle.Engine.Gltf;
using UnityEngine.Splines;

namespace Needle.Engine.Splines
{
	[UsedImplicitly]
	public class SplineValueResolver : GltfExtensionHandlerBase, IValueResolver, IAdditionalDataProvider
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			context.RegisterValueResolver(this);
			_splines.Clear();
		}
		
		private static readonly Dictionary<SplineContainer, Spline> _splines = new Dictionary<SplineContainer, Spline>();

		public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
		{
			if (instance is SplineContainer splineContainer )
			{
				if (value is Spline spline && !_splines.ContainsKey(splineContainer))
				{
					_splines.Add(splineContainer, spline);
				}
			}
			return false;
		}

		public void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData)
		{
			if (instance is SplineContainer container)
			{
				if (_splines.TryGetValue(container, out var spline))
				{
					additionalData.Add(("closed", spline.Closed));
					additionalData.Add(("editType", spline.EditType));
				}
			}
		}
	}
}
#endif