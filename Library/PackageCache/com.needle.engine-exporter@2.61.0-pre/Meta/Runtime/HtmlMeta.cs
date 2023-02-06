using System;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Needle.Engine
{
	public class HtmlMeta : MonoBehaviour
	{
		public Meta meta = new Meta();

		[Serializable]
		public class Meta
		{
			public string title = "Needle Engine";
			public string description = "🌵 Made with Needle Engine";
			public Texture2D image;
		}

#if UNITY_EDITOR
		private void OnValidate()
		{
			if (meta.title == null)
			{
				meta.title = SceneManager.GetActiveScene().name;
			}
		}
#endif
	}
}