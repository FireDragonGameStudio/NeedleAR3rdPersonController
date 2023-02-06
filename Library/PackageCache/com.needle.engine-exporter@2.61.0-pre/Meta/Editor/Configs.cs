using Needle.Engine.Core;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine
{
	internal class MetaConfigProperty : IBuildConfigProperty
	{
		public string Key => "meta";
		public object GetValue(IExportContext context) => Object.FindObjectOfType<HtmlMeta>()?.meta;
	}

    internal class AbsoluteUrl : IBuildConfigProperty
    {
        public string Key => "absolutePath";
        public object GetValue(IExportContext context)
        {
	        if (context is ExportContext exp && exp.BuildContext != null)
	        {
		        if(!string.IsNullOrEmpty(exp.BuildContext.LiveUrl))
			        return exp.BuildContext.LiveUrl;
		        if(!exp.BuildContext.IsDistributionBuild)
			        return "https://localhost:3000";
	        }
	        return null;
        }
    }
    
    internal class ProjectName : IBuildConfigProperty
    {
	    public string Key => "sceneName";
	    public object GetValue(IExportContext context)
	    {
		    return UnityEditor.ObjectNames.NicifyVariableName(SceneManager.GetActiveScene().name);
	    }
    }

    internal class DeployOnly : IBuildConfigProperty
    {
	    public string Key => "deployOnly";
	    
	    public object GetValue(IExportContext context)
	    {
		    if (context is ExportContext ctx)
		    {
			    return ctx.BuildContext.Command == BuildCommand.PrepareDeploy;
		    }
		    
		    return false;
	    }
    }
}