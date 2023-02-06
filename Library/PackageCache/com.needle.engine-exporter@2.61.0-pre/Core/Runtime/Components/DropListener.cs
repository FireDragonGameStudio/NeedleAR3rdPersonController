using Needle.Engine.Utils;
using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class DropListener : MonoBehaviour
    {
        [Info("Backend url, can be absolute or relative. When running locally the localhost url is used instead")]
        public string filesBackendUrl;
        
        [Header("Used for local dev")]
        public string localhost;
        
		
#if UNITY_EDITOR
        private void OnValidate()
        {
            if (filesBackendUrl == null) return;
            
            if (GlitchUtils.TryGetProjectName(filesBackendUrl, out var projectName))
            {
                filesBackendUrl = "https://" + projectName + ".glitch.me";
            }

            while (filesBackendUrl.EndsWith("/")) filesBackendUrl = filesBackendUrl.Substring(0, filesBackendUrl.Length-1);
        }
#endif
    }
}
