using System;
using System.Collections.Generic;
using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class LODData : BaseAdditionalData
	{
		private Camera _mainCamera = null;

		public override void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData)
		{
			if (instance is LODGroup lods)
			{
				var ds = lods.GetLODs();

				if (!_mainCamera || _mainCamera.CompareTag("MainCamera") == false)
				{
					this._mainCamera = Camera.main;
					if (!this._mainCamera && Camera.allCameras.Length > 0) this._mainCamera = Camera.allCameras[0];
				}
				if (_mainCamera)
				{
					var models = new List<LodGroupModel>();
					foreach (var lod in ds)
					{
						var model = new LodGroupModel();
						models.Add(model);
						model.screenRelativeTransitionHeight = lod.screenRelativeTransitionHeight;
						model.distance = LODUtilityAccess.CalculateDistance(_mainCamera, lod.screenRelativeTransitionHeight, lods);
						foreach (var rend in lod.renderers)
						{
							model.renderers.Add((rend.GetId()));
						}
					}
					additionalData.Add(("lodModels", models));
				}
			}
		}

		[Serializable]
		public class LodGroupModel
		{
			public float distance;
			public float screenRelativeTransitionHeight;
			public List<string> renderers = new List<string>();
		}
	}
}