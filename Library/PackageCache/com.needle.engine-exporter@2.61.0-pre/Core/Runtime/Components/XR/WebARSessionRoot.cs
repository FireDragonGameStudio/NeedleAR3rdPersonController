using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class WebARSessionRoot : MonoBehaviour
    {
        [Info("User scale. Typically, will be greater than one, so that the AR user is bigger and looks at a small scene.")]
        public float arScale = 1;
        public bool invertForward = false;
    }
}
