using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class TransformGizmo : MonoBehaviour
    {
        public bool isGizmo = true;

        private void OnDrawGizmos()
        {
            Gizmos.matrix = transform.localToWorldMatrix;
            Gizmos.color = Color.red;
            Gizmos.DrawLine(Vector3.left, -Vector3.left);
            Gizmos.color = Color.blue;
            Gizmos.DrawLine(-Vector3.forward, Vector3.forward);
            Gizmos.color = Color.green;
            Gizmos.DrawLine(-Vector3.up, Vector3.up);
        }
    }
}
