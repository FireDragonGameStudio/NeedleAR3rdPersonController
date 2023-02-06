using System;
using UnityEngine;

namespace Needle.Engine.Shaders
{
	public class SkyboxExportSettings : MonoBehaviour, ISkyboxExportSettingsProvider
	{
		[field: SerializeField] public int SkyboxResolution { get; set; } = 256;
		[field: SerializeField, HideInInspector] public bool HDR { get; set; } = true;

		private void OnValidate()
		{
			SkyboxResolution = Mathf.NextPowerOfTwo(SkyboxResolution);
		}
	}
}