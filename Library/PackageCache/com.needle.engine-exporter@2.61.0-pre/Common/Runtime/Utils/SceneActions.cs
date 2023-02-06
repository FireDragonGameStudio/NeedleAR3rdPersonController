using System;

namespace Needle.Engine.Utils
{
	public static class SceneActions
	{
		private static Action createGltfObjectAction;
		
		internal static void RegisterCreateGltfObjectAction(Action act)
		{
			createGltfObjectAction = act;
		}
		
		public static bool CreateGltfObject()
		{
			if (createGltfObjectAction == null) return false;
			createGltfObjectAction();
			return true;
		}
	}
}