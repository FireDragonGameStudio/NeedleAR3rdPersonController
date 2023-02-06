using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace Needle.Engine.Samples.Helpers
{
    [Serializable]
    internal class SampleCollection : ScriptableObject
    {
        [JsonProperty]
        internal List<SampleInfo> samples = new List<SampleInfo>();
    }
}