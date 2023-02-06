using System;
using JetBrains.Annotations;
using UnityEngine;

namespace Needle.Engine.AdditionalData
{
	public class LightShadowData : AdditionalComponentData<Light>
	{
		[Info("Set the size and far plane of the threejs shadow camera. Use ?debuglights url parameter to visualize this in the browser.")]
		public float shadowWidth = 10;
		public float shadowHeight = 10;
		public float shadowDistance = 300;
		public float shadowResolution = 2048;

		[Header("Shadow Bias Override")] 
		public float shadowBias = 0.00001f;
		public float shadowNormalBias = 0.015f;

#pragma warning disable 414
		[SerializeField, HideInInspector] [UsedImplicitly] private bool _overrideShadowBiasSettings = true;
#pragma warning restore 414
		
		private void OnValidate()
		{
			_overrideShadowBiasSettings = true;
		}

		private void OnDrawGizmosSelected()
		{
			if (this.TryGetComponent(out Light l))
			{
				if (l.type != LightType.Directional || l.shadows == LightShadows.None) return;
				Gizmos.color = l.color;
			}
			var t = transform;
			var mat = Matrix4x4.TRS(t.position, t.rotation, Vector3.one);
			Gizmos.matrix = mat;
			Gizmos.DrawWireCube(new Vector3(0,0, shadowDistance * .5f), new Vector3(this.shadowWidth,this.shadowHeight, shadowDistance));
		}
	}
}