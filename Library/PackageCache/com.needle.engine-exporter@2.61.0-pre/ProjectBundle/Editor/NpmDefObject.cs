using System;
using System.Linq;
using JetBrains.Annotations;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	public class NpmDefObject : ScriptableObject
	{
		[SerializeField, HideInInspector] [UsedImplicitly] internal string displayName;

		private Bundle bundle;

		private void OnEnable()
		{
			this.bundle ??= FindBundle();
			displayName = this.bundle?.FindPackageName() ?? "";
		}
		
		public Bundle FindBundle()
		{
			if (this.bundle != null) return this.bundle;
			var path = AssetDatabase.GetAssetPath(this);
			return BundleRegistry.Instance.Bundles.FirstOrDefault(b => b.FilePath == path);
		}

		public override string ToString()
		{
			return displayName;
		}
	}
}