using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public static class BuildTargetManager
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			// log available build target combinations
			// foreach(BuildTargetGroup val in Enum.GetValues(typeof(BuildTargetGroup)))
			// foreach (BuildTarget val2 in Enum.GetValues(typeof(BuildTarget)))
			// {
			//     var works = BuildPipeline.IsBuildTargetSupported(val, val2);
			//     if(works)
			//         Debug.Log(val + " : " + val2 + ": " + works);
			// }

			// log all build target attributes
			// foreach (BuildTargetGroup targetGroup in Enum.GetValues(typeof(BuildTargetGroup)))
			// {
			//     Debug.Log("<b>" + targetGroup + "</b>");
			//     foreach(BuildTargetDiscovery.TargetAttributes attr in Enum.GetValues(typeof(BuildTargetDiscovery.TargetAttributes)))
			//     {
			//         if (BuildTargetDiscovery.PlatformGroupHasFlag(targetGroup, attr))
			//             Debug.Log("\t" + attr);
			//     }
			// }

			// will only get nice names for supported platforms
			// foreach (BuildTarget target in Enum.GetValues(typeof(BuildTarget)))
			//     Debug.Log(target + " => " + BuildTargetDiscovery.GetBuildTargetNiceName(target));

			var bi = BuildPlatforms.instance;
			var platforms = bi.buildPlatforms.ToList();

			var platformToShim = platforms.Find(x => x.targetGroup == BuildPlatformConstants.BuildTargetGroup);
			if (platformToShim != null)
				platforms.Remove(platformToShim);

			var platform = BuildPlatformConstants.Platform;
			
			// insert above webgl
			var inserted = false;
			for (var i = 0; i < platforms.Count; i++)
			{
				var other = platforms[i];
				if (other.name == "WebGL")
				{
					inserted = true;
					platforms.Insert(i, platform);
					break;
				}
			}
			if (!inserted) platforms.Insert(3, platform);

			// var platform2 = new BuildPlatform("Three.js (Test)", IconPath + "/three-icon.png", BuildTargetGroup.Standalone, BuildTarget.StandaloneLinux64, true);
			// platform2.GetType().GetField("m_SmallTitle", (BindingFlags)(-1))?.SetValue(platform, new ScalableGUIContent((string) null, (string) null, IconPath + "/three-icon-small.png"));
			// platforms.Add(platform2);

			bi.buildPlatforms = platforms.ToArray();
		}
	}
}