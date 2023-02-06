using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using JetBrains.Annotations;
using UnityEditor;
using UnityEngine;
using UnityEngine.Serialization;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf.ImportSettings
{
	public abstract class AssetSettings : ScriptableObject
	{
		[HideInInspector, SerializeField] 
		internal Object asset;

		[SerializeField]
		internal string identifier;

		/// <summary>
		/// Override to draw custom GUI, return true to draw the default GUI
		/// </summary>
		/// <returns></returns>
		internal virtual bool OnGUI() => true;
	}

	public class NeedleAssetSettings : ScriptableObject
	{
		[HideInInspector, SerializeField, UsedImplicitly]
		internal Object asset;

		[SerializeField] 
		[HideInInspector]
		private List<AssetSettings> assetSettings = new List<AssetSettings>();

#if UNITY_EDITOR
		internal void Init(string path)
		{
			asset = AssetDatabase.LoadMainAssetAtPath(path);
			var assets = AssetDatabase.LoadAllAssetsAtPath(path);
			foreach (var assetAtPath in assets)
			{
				var entry = default(AssetSettings);
				if (assetAtPath is Mesh mesh)
				{
					entry = CreateInstance<MeshSettings>();
					entry.asset = mesh;
				}
				else if (assetAtPath is Texture tex)
				{
					entry = CreateInstance<TextureSettings>();
					entry.asset = tex;
				}
				
				if (entry)
				{
					entry.name = assetAtPath.name;
					entry.identifier = GetIdentifier(entry.asset);
					assetSettings.Add(entry);
				}
			}

			// make sure sub-assets are hidden
			foreach (var assetSetting in assetSettings)
			{
				assetSetting.hideFlags = HideFlags.HideInHierarchy;
			}
		}
		
		[ContextMenu(nameof(ToggleSubassetVisibility))]
		private void ToggleSubassetVisibility()
		{
			foreach (var setting in assetSettings)
			{
				setting.hideFlags = setting.hideFlags == HideFlags.HideInHierarchy ? HideFlags.None : HideFlags.HideInHierarchy;
			}
			var path = AssetDatabase.GetAssetPath(this);
			AssetDatabase.ImportAsset(path);
		}

		internal static string GetIdentifier(Object asset)
		{
			switch (asset)
			{
				case Mesh mesh:
					return asset.name;
				case Texture tex:
					return tex.imageContentsHash.ToString();
			}
			return string.Empty;
		}

		internal void OnSaved()
		{
			for (var index = 0; index < assetSettings.Count; index++)
			{
				var assetSetting = assetSettings[index];
				if (!EditorUtility.IsPersistent(assetSetting))
				{
					EditorUtility.SetDirty(assetSetting);
					AssetDatabase.AddObjectToAsset(assetSetting, this);
				}
			}
			AssetDatabase.ImportAsset(AssetDatabase.GetAssetPath(this), ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
			if (!Settings.Contains(this))
				Settings.Add(this);
		}

		internal bool TryGetAssetSettings(Object asset, out AssetSettings settings)
		{
			settings = assetSettings?.FirstOrDefault(m => m.asset == asset);
			return settings;
		}

		internal bool TryResolveMissing(Object assetToFind, out AssetSettings resolved)
		{
			var identifier = GetIdentifier(assetToFind);
			foreach (var setting in assetSettings)
			{
				var existing = setting.asset;
				if (!existing && !string.IsNullOrEmpty(identifier))
				{
					if (setting.identifier == identifier)
					{
						setting.asset = assetToFind;
						resolved = setting;
						return true;
					}
				}
			}
			resolved = null;
			return false;
		}

		internal void SetSettings(NeedleTextureSettings settings)
		{
			foreach (var assetSetting in this.assetSettings)
			{
				if(assetSetting is TextureSettings tex)
					tex.Settings = settings;
			}
		}
		
		internal static bool TryGetSettings(Object asset, out AssetSettings settings)
		{
			foreach (var set in Settings)
			{
				if (set.TryGetAssetSettings(asset, out settings)) return true;
				// if the asset is the asset we're looking for but it doesnt have settings for it
				// we can stop searching
				if (set.asset == asset)
				{
					return false;
				}
			}
			settings = null;
			return false;
		}

		private static List<NeedleAssetSettings> _settings;
		/// <summary>
		/// All NeedleAssetSettings in the project
		/// </summary>
		internal static List<NeedleAssetSettings> Settings
		{
			get
			{
				if (_settings == null)
				{
					_settings = new List<NeedleAssetSettings>();
					var guids = AssetDatabase.FindAssets("t:NeedleAssetSettings");
					foreach (var guid in guids)
					{
						var path = AssetDatabase.GUIDToAssetPath(guid);
						var settings = AssetDatabase.LoadAssetAtPath<NeedleAssetSettings>(path);
						if (settings != null)
							_settings.Add(settings);
					}
				}
				return _settings;
			}
		}
#endif
	}
}