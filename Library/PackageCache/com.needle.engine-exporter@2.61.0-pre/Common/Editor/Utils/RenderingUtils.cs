using UnityEngine.Rendering;

namespace Needle.Engine.Utils
{
	public static class RenderingUtils
	{
		public static bool IsUsingURP()
		{
			var asset = GraphicsSettings.currentRenderPipeline;
			if (asset && asset.GetType().Name.Contains("Universal")) return true;
			return false;
		}
	}
}