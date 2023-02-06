#if UNITY_EDITOR

using GLTF.Schema;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using UnityGLTF;

namespace Needle.Engine.Gltf.UnityGltf.Animation
{
	public class KHR_animation2_Extension
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			GLTFSceneExporter.AfterSceneExport += OnAfterSceneExport;
		}

		private static void OnAfterSceneExport(GLTFSceneExporter exporter, GLTFRoot root)
		{
			KHR_Animation2.Create(exporter, root);
		}

		// private static void OnAfterSceneExport(GLTFSceneExporter exporter, GLTFRoot root, Transform transform, Node node)
		// {
		// 	KHR_Animation2.Create(transform, node);
		// }
	}

	public class KHR_Animation2 : IExtension
	{
		public const string ExtensionName = "KHR_animation2";

		public static void Create(GLTFSceneExporter exporter, GLTFRoot root) // Node node)
		{
			// var transform = exporter.RootTransform;
			// if (!transform) return;
			// if (HasAnimation(transform))
			// 	root.AddExtension(KHR_Animation2.ExtensionName, new KHR_Animation2(exporter, root, transform));
		}

		private static bool HasAnimation(Component t)
		{
			return true;
			// return t.TryGetComponent<UnityEngine.Animation>(out _);
		}

		private readonly GLTFSceneExporter exporter;
		private readonly GLTFRoot root;
		private readonly Transform transform;

		public KHR_Animation2(GLTFSceneExporter exporter, GLTFRoot root, Transform target)
		{
			this.exporter = exporter;
			this.root = root;
			transform = target;
		}

		public JProperty Serialize()
		{
			if (!TryExportAnimationData(out var ext))
				ext = new JObject();
			return new JProperty(ExtensionName, ext);
		}

		public IExtension Clone(GLTFRoot _root)
		{
			return new KHR_Animation2(exporter, _root, transform);
		}

		private bool TryExportAnimationData(out JObject obj)
		{
			obj = default;
			if (!transform)
				return false;
			var animationComp = transform.GetComponentsInChildren<UnityEngine.Animation>();
			foreach (var comp in animationComp)
			{
				obj = CreateAnimationObject();
				foreach (AnimationClip clip in comp)
				{
					AppendAnimationData(obj, clip);
				}
			}
			return false;
		}

		private JObject CreateAnimationObject()
		{
			var obj = new JObject();
			obj.Add("animations", new JArray());
			return obj;
		}

		private void AppendAnimationData(JObject obj, AnimationClip clip)
		{
			var bindings = AnimationUtility.GetCurveBindings(clip);
			foreach (var bind in bindings)
			{
			}
		}
	}
}
#endif