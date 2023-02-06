using System;
using Needle.Engine.Gltf.ImportSettings;
using UnityEditor;

namespace Needle.Engine.ImportSettings
{
	[CustomEditor(typeof(NeedleAssetSettings))]
	public class NeedleAssetSettingsEditor : Editor
	{
		private string assetPath;

		private void OnEnable()
		{
			assetPath = AssetDatabase.GetAssetPath((target as NeedleAssetSettings)!.asset);
		}

		public override void OnInspectorGUI()
		{
			EditorGUILayout.HelpBox("Contains asset import settings for " + assetPath, MessageType.None);
		}
	}
}