using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class SyncedCamera : MonoBehaviour
    {
        public Camera cam = null;
        public GameObject cameraPrefab;
    }
}
