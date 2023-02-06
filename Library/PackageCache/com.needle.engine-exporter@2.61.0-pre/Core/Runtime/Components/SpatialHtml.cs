using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class SpatialHtml : MonoBehaviour
    {
        public string id;
        public bool keepAspect = false;

        private void OnDrawGizmos()
        {
            Gizmos.matrix = transform.localToWorldMatrix;
            Gizmos.DrawWireCube(Vector3.zero, new Vector3(1, 1, 0));
        }
    }
}
