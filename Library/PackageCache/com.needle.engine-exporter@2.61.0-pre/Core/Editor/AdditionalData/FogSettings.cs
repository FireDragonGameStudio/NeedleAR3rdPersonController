using System;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.AdditionalData
{
	public class FogSettings : IBuildStageCallbacks
	{
		private Fog fog;
		
		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			if (stage == BuildStage.PreBuildScene)
			{
				try
				{
					var exportObject = ObjectUtils.FindObjectOfType<IExportableObject>() as Component;
					if (exportObject)
					{
						fog = exportObject.gameObject.AddComponent<Fog>();
						fog.hideFlags = HideFlags.HideAndDontSave;
						fog.enabled = RenderSettings.fog;
						fog.mode = RenderSettings.fogMode;
						fog.color = RenderSettings.fogColor;
						fog.density = RenderSettings.fogDensity;
						fog.near = RenderSettings.fogStartDistance;
						fog.far = RenderSettings.fogEndDistance;
					}
				}
				catch(Exception ex)
				{
					// ignored
					Debug.LogWarning("Failed to export fog\n" + ex);
				}
			}
			else if (stage == BuildStage.PostBuildScene || stage == BuildStage.BuildFailed)
			{
				if (fog)
				{
					Object.DestroyImmediate(fog);
					fog = null;
				}
			}
			
			return Task.FromResult(true);
		}
	}
}