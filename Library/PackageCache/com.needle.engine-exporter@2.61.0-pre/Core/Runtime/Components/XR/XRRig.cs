using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class XRRig : MonoBehaviour
    {
        private void OnDrawGizmos()
        {
            Gizmos.matrix = transform.localToWorldMatrix;
            var size = Vector3.one;
            Gizmos.color = Color.blue;
            Gizmos.DrawLine(Vector3.zero, Vector3.forward);
            Gizmos.color = Color.green;
            Gizmos.DrawWireCube(new Vector3(0, size.y * .5f, 0), size);
        }
    }
}
