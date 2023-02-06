using System.Collections.Generic;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace Needle.Engine.Editors
{
	public abstract class ComponentEditorExtension
	{
		public abstract bool ShouldExtend(Object target);
		public abstract void OnInspectorGUI(Object target);
	}

	public static class ComponentEditorExtensionHandler
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			_extensions = InstanceCreatorUtil.CreateCollectionSortedByPriority<ComponentEditorExtension>();
			if (_extensions.Count > 0)
				InspectorHook.Inject += OnInject;
		}

		private static List<ComponentEditorExtension> _extensions = new List<ComponentEditorExtension>();

		private static void OnInject(Editor arg1, VisualElement arg2)
		{
			var t = arg1.target;
			foreach (var ext in _extensions)
			{
				if (ext.ShouldExtend(t))
				{
					var wrapper = new IMGUIContainer();
					arg2.Add(wrapper);
					wrapper.onGUIHandler += () => ext.OnInspectorGUI(t);
				}
			}
		}
	}
}