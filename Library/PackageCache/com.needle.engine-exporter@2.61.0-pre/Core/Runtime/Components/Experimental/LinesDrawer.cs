using System;
using UnityEngine;

namespace Needle.Engine.Components
{
    [Obsolete]
    [HelpURL(Constants.DocumentationUrl)]
    public class LinesDrawer : MonoBehaviour
    {
        public LinesManager Lines;
        public Transform[] Colliders;
        public bool AlignToSurface = true;
        public bool AddToPaintedObject = true;
    }
}
