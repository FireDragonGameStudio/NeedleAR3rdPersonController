using UnityEngine;

namespace Needle.Engine.AdditionalData
{
    public class CameraSkyboxData : AdditionalComponentData<Camera>
    {
        [Range(0,1), Info("Background blur amount. Not visible in Unity")]
        public float backgroundBlurriness = 0;
        [Range(0,5), Info("Background intensity. Not visible in Unity")]
        public float backgroundIntensity = 1;
    }
}
