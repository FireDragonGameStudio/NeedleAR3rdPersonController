using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Core;
using Needle.Engine.Interfaces;
using UnityEditor;
using Object = UnityEngine.Object;

namespace Needle.Engine
{
	internal class WriteSceneSettings : IBuildStageCallbacks
	{
		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			// TODO would be better if IBuildStageCallbacks would also work in the scene / from MonoBehaviours, or is there an alternative?
			var data = Object.FindObjectOfType<HtmlMeta>();
            
			// manual copy, TODO can we do this with an attribute?
			if (stage == BuildStage.PostBuildScene && data && data.meta != null && data.meta.image)
			{
				var path = AssetDatabase.GetAssetPath(data.meta.image);
				var targetDir = context.Project.ProjectDirectory + "/include/";
				if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
				File.Copy(path, targetDir + Path.GetFileName(path), true);
			}
            
			return Task.FromResult(true);
		}
	}
}