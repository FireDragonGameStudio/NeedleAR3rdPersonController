using System.Linq;
using Needle.Engine.Editors;
using Needle.Engine.Utils;
using Unity.Collections.LowLevel.Unsafe;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Hierarchy
{
	public static class MarkEditorOnly
	{
		private const string LogoGuid = "39a802f6842d896498768ef6444afe6f";

		public static bool Enabled
		{
			get => EditorPrefs.GetBool("NeedleHierarchyDrawer_Enabled", true);
			set => EditorPrefs.SetBool("NeedleHierarchyDrawer_Enabled", value);
		}

		[InitializeOnLoadMethod]
		private static void Init()
		{
			EditorApplication.hierarchyWindowItemOnGUI += DrawInHierarchy;

			backgroundColor = EditorGUIUtility.isProSkin
				? new Color32(56, 56, 56, 255)
				: new Color32(194, 194, 194, 255);
			backgroundColor *= GUI.backgroundColor;

			selectedColor = new Color32(44, 93, 135, 255);
		}

		private static GUIStyle utfIconStyle;
		private static Color backgroundColor, selectedColor;
		private static GUIContent editorOnlyGuiContent, editorOnlyLogo, gltfIcon;
		private static Texture2D logo;

		private static void DrawInHierarchy(int instanceID, Rect selectRect)
		{
			if (!Enabled) return;

			var gameObject = EditorUtility.InstanceIDToObject(instanceID) as GameObject;
			if (!gameObject || gameObject == null) return;
			if (gameObject.CompareTag("EditorOnly"))
			{
				DrawIcon(true, selectRect, instanceID, gameObject);
			}
			else if (gameObject.TryGetComponent<ExportInfo>(out _))
			{
				DrawIcon(false, selectRect, instanceID, gameObject);
			}
			else if (gameObject.TryGetComponent<IExportableObject>(out _))
			{
				DrawIcon(false, selectRect, instanceID, gameObject);
			}
		}

		private static void DrawIcon(bool isEditorOnly, Rect selectRect, int instanceID, GameObject gameObject)
		{
			if (utfIconStyle == null)
			{
				utfIconStyle = new GUIStyle(EditorStyles.label);
				utfIconStyle.alignment = TextAnchor.MiddleLeft;
				var c = utfIconStyle.normal.textColor;
				c.a = .5f;
				utfIconStyle.normal.textColor = c;
				utfIconStyle.fontSize += 2;
			}

			const string tooltip = "This GameObject is not included in builds: tagged with \"Editor Only\"";
			if (editorOnlyGuiContent == null)
			{
				editorOnlyGuiContent = new GUIContent("○", tooltip);
			}

			if (editorOnlyLogo == null)
			{
				if (!logo)
					logo = AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath(LogoGuid));
				if (logo)
					editorOnlyLogo = new GUIContent(logo, tooltip);
			}

			if (gltfIcon == null)
			{
				gltfIcon = new GUIContent(Assets.Circle);
			}

			var rect = selectRect;
			rect.width = 17;


			EditorGUI.DrawRect(rect, Selection.instanceIDs.Contains(instanceID) ? selectedColor : backgroundColor);

			if (editorOnlyLogo != null && gameObject.TryGetComponent<ExportInfo>(out _))
			{
				rect.x += .5f;
				rect.y -= 1f;
				EditorGUI.LabelField(rect, editorOnlyLogo, utfIconStyle);
			}
			else if (isEditorOnly)
			{
				rect.x += .5f;
				rect.y -= 1f;
				EditorGUI.LabelField(rect, editorOnlyGuiContent, utfIconStyle);
			}
			else if (gameObject.TryGetComponent<IExportableObject>(out var exportableObject))
			{
				const float factor = .65f;
				rect.x += rect.width * (1 - factor) * .5f;
				rect.y += rect.height * (1 - factor) * .5f;
				rect.width *= factor;
				rect.height *= factor;
				
				EditorGUI.LabelField(rect, gltfIcon, utfIconStyle);
				
				if (exportableObject is IHasSmartExport smartExport && smartExport.SmartExportEnabled && smartExport.IsDirty)
				{
					var nameRect = GUILayoutUtility.GetRect(new GUIContent(gameObject.name), EditorStyles.label, GUILayout.ExpandWidth(false));
					selectRect.xMin += nameRect.width + 16;
					EditorGUI.LabelField(selectRect, "*", EditorStyles.label);
				}
			}

			// ◆ ❖ ◇ 
			// EditorGUI.LabelField(selectRect, "Not in build", new GUIStyle(EditorStyles.centeredGreyMiniLabel)
			// {
			//     alignment = TextAnchor.MiddleRight
			// });
		}

		// private static Color? _gltfIconColor;
		//
		// private static Color gltfIconColor
		// {
		// 	get
		// 	{
		// 		if (_gltfIconColor == null)
		// 		{
		// 			if (ColorUtility.TryParseHtmlString("#74AF52", out var col))
		// 				_gltfIconColor = col;
		// 		}
		// 		return _gltfIconColor ??= Color.white;
		// 	}
		// }
	}
}