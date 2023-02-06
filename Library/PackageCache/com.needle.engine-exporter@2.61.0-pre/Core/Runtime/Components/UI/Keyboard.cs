using UnityEngine;
using UnityEngine.UI;

namespace Needle.Engine.Components
{
    [HelpURL(Constants.DocumentationUrl)]
    public class Keyboard : MonoBehaviour
    {
        public Font Font;
        public Text Text;
        public KeymapOption Keymap = KeymapOption.eng;
        public float Padding = .1f;
        public float Margin = .1f;
        public float FontSize = 6;
        public float BorderRadius = 1;

        public enum KeymapOption
        {
            fr,
            ru,
            de,
            es,
            el,
            nord,
            eng
        }
    }
}
