using System;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.UIElements;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace Needle.Engine.Editors
{
	internal class RebuildHandler : ICanRebuild
	{
		private readonly VisualElement root;
		private readonly string guid;
		private readonly SerializedObject obj;
		private readonly Action<VisualElement> onBuild;

		public RebuildHandler(VisualElement root, string guid, Object obj = null, Action<VisualElement> onBuild = null)
		{
			this.root = root;
			this.guid = guid;
			if (obj)
				this.obj = new SerializedObject(obj);
			this.onBuild = onBuild;
			UxmlWatcher.RegisterGUID(guid, this);
		}

		public void Rebuild()
		{
			var uiAsset = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(AssetDatabase.GUIDToAssetPath(guid));
			var ui = uiAsset.CloneTree();
			root.Clear();
			root.Add(ui);
			onBuild?.Invoke(root);
			if (obj != null) root.Bind(obj);
		}
	}

	internal static class UIComponents
	{
		public static VisualElement Build(string guid, Object model = null, Action<VisualElement> onBuild = null)
		{
			var el = new VisualElement();
			var rb = new RebuildHandler(el, guid, model, onBuild);
			rb.Rebuild();
			return el;
		}
		
		public static VisualElement BuildExportInfo(VisualElement el, Object obj = null)
		{
			var rb = new RebuildHandler(el, "8f47abfe843b4555b78da6bf817a7f5a", obj);
			rb.Rebuild();
			return el;
		}

		public static VisualElement BuildHeader(VisualElement el)
		{
			var rb = new RebuildHandler(el, "4f8f633e64e64ba9a4bedd74caf4d35d");
			rb.Rebuild();
			return el;
		}


		public static void RegisterAction(this VisualElement ui, string className, Action action)
		{
			ui.Query<Button>(null, className).ForEach(b => { b.clicked += action; });
		}
	}
}