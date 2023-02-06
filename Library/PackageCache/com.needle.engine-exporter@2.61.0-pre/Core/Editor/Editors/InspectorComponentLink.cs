using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace Needle.Engine.Editors
{
	public static class InspectorComponentLink
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			exportInfo = Object.FindObjectOfType<ExportInfo>();
			InspectorHook.Inject += OnInject;
		}

		private static readonly Type[] ignore =
		{
			typeof(GameObject)
		};

		private static void OnInject(Editor editor, VisualElement visualElement)
		{
			var type = editor.target?.GetType();
			if (ignore.Contains(type)) return;
			var children = visualElement.Children();
			var header = children.FirstOrDefault();
			visualElement.Insert(1, new TypescriptHookDrawer(header, editor.target, type));
		}

		private static ExportInfo exportInfo = null;
		private static readonly ProjectInfo projectInfo = new ProjectInfo(null);

		private class TypescriptHookDrawer : VisualElement
		{
			public TypescriptHookDrawer(VisualElement header, Object target, Type type)
			{
				this.type = type;
				this.target = target;
				this.typeName = type.Name;
				this.label = new Label();
				this.Add(this.label);
				this.RegisterCallback<AttachToPanelEvent>(OnAttachToPanel);
				header.RegisterCallback<ClickEvent>(OnClickedHeader);
				// this.RegisterCallback<GeometryChangedEvent>(OnGeometryChanged);

				this.style.paddingLeft = 18;
				this.style.paddingTop = 2;
				this.style.overflow = Overflow.Hidden;

				async void OnClick()
				{
					if (this.matchingTypescript != null)
					{
						// try open workspace in current package json directory
						// this should open the npmDef workspace when the file is part of an npmDef
						var packageJsonDirectory = this.matchingTypescript.PackageJson?.DirectoryName;
						if (!string.IsNullOrEmpty(packageJsonDirectory))
						{
							if (ExportInfoEditor.TryGetVsCodeWorkspacePath(packageJsonDirectory, out var workspacePath))
							{
								EditorUtility.OpenWithDefaultApp(workspacePath);
								await Task.Delay(500);
							}
						}
						else
						{
							if(!exportInfo)
								exportInfo = Object.FindObjectOfType<ExportInfo>();
							if (exportInfo != null)
							{
								if (ExportInfoEditor.TryGetVsCodeWorkspacePath(exportInfo.DirectoryName, out var workspacePath))
								{
									EditorUtility.OpenWithDefaultApp(workspacePath);
									await Task.Delay(500);
								}
							}
						}
						var filePath = this.matchingTypescript.FilePath;
						Application.OpenURL(filePath);
					}
				}

				this.label.AddManipulator(new Clickable(OnClick));
				this.originalHeight = this.style.height;
				this.originalMarginBottom = this.style.marginBottom;
				this.UpdateVisibility();
			}

			private readonly string typeName;
			private readonly Object target;
			private readonly Type type = null;
			private readonly Label label = null;
			private ImportInfo matchingTypescript = null;
			private readonly StyleLength originalHeight, originalMarginBottom;
			private bool showLabel = false;
			private VisualElement possibleWrongComponentInfo = null;

			private void OnAttachToPanel(AttachToPanelEvent evt)
			{
				this.showLabel = false;
				matchingTypescript = null;
				this.label.text = "";
				this.label.tooltip = "";
				if (projectInfo != null)
				{
					if (exportInfo)
						projectInfo.UpdateFrom(exportInfo.DirectoryName);
					var match = TypesUtils.GetTypes(projectInfo).FirstOrDefault(
						k => string.Equals(k.TypeName, this.typeName, StringComparison.InvariantCultureIgnoreCase)
					);
					this.matchingTypescript = match;
					if (match != null)
					{
						this.showLabel = true;
						var col = match.IsInstalled ? new Color(.6f, .7f, .8f) : new Color(.8f, .5f, .7f);
						this.label.style.color = new StyleColor(col);
						this.label.text = $"{match.TypeName} {Constants.ExternalLinkChar}";
						this.label.tooltip = "Open script at " + Path.GetFullPath(match.FilePath);
						if (!match.IsInstalled) this.label.tooltip += "\n\n(not installed in current project)";

						if (HasCodegenFileButIsNotUsingCodeGenFile(match, out _))
						{
							if (possibleWrongComponentInfo == null)
							{
								var warningLabel = new Label(text: "A generated component exists for this type but you are not using it here. Changes in codegen will not be reflected here.");
								possibleWrongComponentInfo = warningLabel;
								possibleWrongComponentInfo.style.fontSize = 10;
								possibleWrongComponentInfo.style.whiteSpace = WhiteSpace.Normal;
								possibleWrongComponentInfo.style.color = new StyleColor(new Color(.7f, .7f, .7f));
								this.Add(possibleWrongComponentInfo);
							}
						}
						else if (this.possibleWrongComponentInfo?.parent != null)
						{
							this.possibleWrongComponentInfo.RemoveFromHierarchy();
						}
					}
					else if (ExporterProjectSettings.instance.debugMode)
					{
						this.showLabel = true;
						this.label.style.color = new StyleColor(new Color(.7f, .5f, .5f));
						this.label.text = "Not found: " + this.typeName;
					}
				}
				this.UpdateVisibility();
			}

			private void OnClickedHeader(ClickEvent evt)
			{
				UpdateVisibility();
			}

#if UNITY_2022_1_OR_NEWER
			protected override void ExecuteDefaultAction(EventBase evt)
			{
				base.ExecuteDefaultAction(evt);
				this.UpdateVisibility();
			}
#else
			public override void HandleEvent(EventBase evt)
			{
				base.HandleEvent(evt);
				this.UpdateVisibility();
			}
#endif

			private void UpdateVisibility()
			{
				var exp = showLabel && InternalEditorUtility.GetIsInspectorExpanded(this.target);
				this.style.height = exp ? this.originalHeight : 0;
				this.style.marginBottom = exp ? this.originalMarginBottom : 0;
				// this.visible = InternalEditorUtility.GetIsInspectorExpanded(this.target);
				// this.style.display = (this.visible ? DisplayStyle.Flex : DisplayStyle.None);
			}

			private bool HasCodegenFileButIsNotUsingCodeGenFile(ImportInfo typeInfo, out string codeGenFilePath)
			{
				codeGenFilePath = null;
				if (!(target is MonoBehaviour mb)) return false;
				var script = MonoScript.FromMonoBehaviour(mb);
				var targetPath = AssetDatabase.GetAssetPath(script);
				if (targetPath.Contains(".codegen/")) return false;
				var typePathEnd = "/" + typeInfo.TypeName + ".cs";
				var paths = AssetDatabase.FindAssets(typeInfo.TypeName).Select(AssetDatabase.GUIDToAssetPath).Where(e => e.EndsWith(typePathEnd));
				foreach (var p in paths)
				{
					if (p.Contains(".codegen/"))
					{
						codeGenFilePath = p;
						return true;
					}
				}
				return false;
			}
		}
	}
}