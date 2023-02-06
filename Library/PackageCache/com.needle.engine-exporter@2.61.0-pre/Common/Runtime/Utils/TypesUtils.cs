using System;
using System.Collections.Generic;
using System.Linq;
using Unity.Profiling;
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.SceneManagement;
#endif
using UnityEngine;

namespace Needle.Engine.Utils
{
	public static class TypesUtils
	{
#if UNITY_EDITOR
		[InitializeOnLoadMethod]
		private static void Init()
		{
			_scanCount = 0;
			MarkDirty();
			EditorSceneManager.activeSceneChangedInEditMode += (a, b) =>
			{
				_scanCount = 0;
				MarkDirty();
			};
			Events.registeringPackages += args =>
			{
				_scanCount = 0;
				MarkDirty();
			};
		}
#endif

		private static bool requireLoadTypes = true;
		private static readonly List<ImportInfo> types = new List<ImportInfo>();

		public static IReadOnlyList<ImportInfo> CurrentTypes => types;

		private static string lastRequestedProjectDirectory;

		public static IReadOnlyList<ImportInfo> GetTypes(IProjectInfo proj)
		{
			if (requireLoadTypes || types.Count <= 0 || proj.ProjectDirectory != lastRequestedProjectDirectory)
			{
				lastRequestedProjectDirectory = proj.ProjectDirectory;
				FindKnownTypes(types, proj);
			}
			return types;
		}

		public static void MarkDirty()
		{
			types.Clear();
			requireLoadTypes = true;
		}

		public static bool IsDirty => requireLoadTypes;

		private static int _scanCount = 0;
		private static ITypesProvider[] _providers;
		private static ProfilerMarker _findTypesMarker = new ProfilerMarker("TypeScanner.FindKnownTypes");

		private static bool FindKnownTypes(List<ImportInfo> list, IProjectInfo proj)
		{
			using (_findTypesMarker.Auto())
			{
				var doLog = _scanCount++ > 0 && proj.Exists() && proj.IsInstalled();
				if (doLog)
				{
					Debug.Log("<b>Types:</b> Start scanning...");
				}
				requireLoadTypes = false;
				list.Clear();
				if (proj == null)
				{
					Debug.LogError("Can not find types without project");
					return false;
				}
				_providers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypesProvider>().ToArray();
				foreach (var prov in _providers)
				{
					prov.AddImports(list, proj);
				}
				if (doLog)
				{
					Debug.Log("<b>Types:</b> Found " + list.Count + " types");
				}
				return true;
			}
		}
	}
}