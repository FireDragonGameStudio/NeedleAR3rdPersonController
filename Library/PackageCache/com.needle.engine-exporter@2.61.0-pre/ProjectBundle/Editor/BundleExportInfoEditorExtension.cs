using System.Collections.Generic;
using System.IO;
using System.Linq;
using Needle.Engine.Editors;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	public static class BundleExportInfoEditorExtension
	{
		[InitializeOnLoadMethod]
		private static void Init()
		{
			ExportInfoEditor.Enabled += OnEnabled;
			ExportInfoEditor.LateInspectorGUI += OnGUI;
		}

		private static NpmDefDependenciesWrapper wrapper = null;
		private static SerializedObject serializedObject;
		private static SerializedProperty property;
		private static readonly List<NpmDefObject> previouslyAssignedDependencies = new List<NpmDefObject>();

		private static void OnEnabled(ExportInfo obj)
		{
			if (!wrapper)
				wrapper = ScriptableObject.CreateInstance<NpmDefDependenciesWrapper>();
			wrapper.Dependencies.Clear();

			var projectDirectory = Path.GetFullPath(obj.GetProjectDirectory());
			var shouldValidatePackageJsonDependencies = false;

			// Make sure every dependency also has a guid
			for (var index = 0; index < obj.Dependencies.Count; index++)
			{
				var dep = obj.Dependencies[index];
				if (string.IsNullOrEmpty(dep.Guid) && File.Exists(dep.VersionOrPath))
				{
					var guid = AssetDatabase.AssetPathToGUID(dep.VersionOrPath);
					Debug.Log("Added missing guid to serialized dependencies: " + dep.Name + "@" + dep.VersionOrPath + " → " + guid);
					dep.Guid = guid;
					obj.Dependencies[index] = dep;
				}
			}

			// Check that dependencies serialized in ExportInfo have the correct name assigned
			// this happens if we e.g. rename an npmdef
			var previouslyFoundDependencies = new HashSet<(string,string,string)>();
			for (var index = obj.Dependencies.Count - 1; index >= 0; index--)
			{
				var dep = obj.Dependencies[index];
				var directory = dep.VersionOrPath.Replace(".npmdef", "~");
				var fullPath = Path.GetFullPath(directory + "/package.json");
				if (File.Exists(fullPath))
				{
					var name = PackageUtils.GetPackageName(fullPath);
					if (dep.Name != name)
					{
						dep.Name = name;
						Debug.Log($"Update serialized dependency with wrong name. Serialized \"{dep.Name}\" is actually \"{name}\"".LowContrast());
						obj.Dependencies[index] = dep;
						shouldValidatePackageJsonDependencies = true;
					}
					
					// Make sure that we dont keep the same serialized dependency multiple times in our list
					var key = (dep.Name, dep.VersionOrPath, dep.Guid);
					if (previouslyFoundDependencies.Contains(key))
					{
						obj.Dependencies.RemoveAt(index);
						shouldValidatePackageJsonDependencies = true;
						continue;
					}
					previouslyFoundDependencies.Add(key);
				}
			}

			const string packageJsonDependenciesKey = "dependencies";
			if (PackageUtils.TryReadDependencies(obj.PackageJsonPath, out var deps, packageJsonDependenciesKey))
			{
				// make sure serialized dependencies get installed
				var didInstall = false;
				foreach (var dep in obj.Dependencies)
				{
					if (!deps.ContainsKey(dep.Name))
					{
						dep.Install(obj.PackageJsonPath);
						didInstall = true;
					}
				}
				if (didInstall)
				{
					PackageUtils.TryReadDependencies(obj.PackageJsonPath, out deps);
				}

				for (var index = 0; index < BundleRegistry.Instance.Bundles.Count; index++)
				{
					var bundle = BundleRegistry.Instance.Bundles[index];
					var packageName = bundle.FindPackageName();
					if (packageName != null && IsNpmdefInDependencies(projectDirectory, deps, packageName, bundle.PackageDirectory))
					{
						var path = bundle.FilePath;
						var def = AssetDatabase.LoadAssetAtPath<NpmDefObject>(path);
						if (def)
						{
							def.displayName = packageName;
							wrapper.Dependencies.Add(def);
							// add the npmdef to the ExportInfo (but dont modify it implicitly for temp projects)
							if (obj.IsTempProject() == false && !obj.Dependencies.Any(d => d.Name == packageName))
								TryAddDependenciesToSerializedList(obj.Dependencies, def);
						}
					}
				}

				if (shouldValidatePackageJsonDependencies)
				{
					EnsureThatNpmdefPackageDependenciesExistOnlyOnce(projectDirectory, packageJsonDependenciesKey, deps);
				}
			}

			previouslyAssignedDependencies.Clear();
			previouslyAssignedDependencies.AddRange(wrapper.Dependencies);

			serializedObject = new SerializedObject(wrapper);
			property = serializedObject.FindProperty(nameof(NpmDefDependenciesWrapper.Dependencies));
		}

		/// <summary>
		/// Iterates over package json dependencies and check if a dependency is a npmdef
		/// If the name (key) and the dependency name (npmdef package.json name) dont match we remove the dependency from our web project
		/// </summary>
		/// <param name="projectDirectory">web project dir</param>
		/// <param name="dependenciesKey">web project package.json KEY (e.g. "dependencies" or "devDependencies")</param>
		/// <param name="dependencies">the dependencies of the package.json</param>
		private static void EnsureThatNpmdefPackageDependenciesExistOnlyOnce(string projectDirectory, string dependenciesKey, Dictionary<string, string> dependencies)
		{
			var toRemove = new List<string>();
			var knownNpmdefBundles = BundleRegistry.Instance.Bundles;
			foreach (var dep in dependencies)
			{
				if (PackageUtils.TryGetPath(projectDirectory, dep.Value, out var path))
				{
					var packageJsonPath = Path.Combine(path, "package.json");
					if (File.Exists(packageJsonPath))
					{
						var name = PackageUtils.GetPackageName(packageJsonPath);
						if (name != dep.Key  && knownNpmdefBundles.Any(b => b.PackageDirectory == path))
						{
							toRemove.Add(dep.Key);
						}
					}
				}
			}
			if (toRemove.Count > 0)
			{
				foreach(var key in toRemove)
				{
					Debug.Log($"Removing dependency that does not exist anymore: {toRemove}".LowContrast());
					dependencies.Remove(key);
				}
				PackageUtils.TryWriteDependencies(projectDirectory + "/package.json", dependencies, dependenciesKey);
			}
		}

		private static bool IsNpmdefInDependencies(string projectDirectory,
			Dictionary<string, string> packageJson,
			string npmdefName,
			string npmdefPath)
		{
			if (packageJson.ContainsKey(npmdefName)) return true;
			foreach (var dep in packageJson)
			{
				if (dep.Key == npmdefName) return true;
				var path = Path.GetFullPath(projectDirectory + "/" + dep.Value);
				if (path == npmdefPath) return true;
			}
			return false;
		}

		private static void OnGUI(ExportInfo obj)
		{
			if (!obj) return;

			if (!obj.Exists() || !obj.IsValidDirectory())
			{
				RenderMissingDependencies(obj);
				return;
			}
			if (property == null) return;
			// using (new EditorGUI.DisabledScope(obj.IsTempProject()))
			{
				using (var change = new EditorGUI.ChangeCheckScope())
				{
					GUILayout.Space(5);
					var changed = EditorGUILayout.PropertyField(property,
						new GUIContent($"Dependencies ({wrapper.Dependencies.Count})",
							"Dependencies in your packages.json that are found as NpmDef files in your project!"), true);
					if (changed || change.changed || wrapper.Dependencies.Count != previouslyAssignedDependencies.Count)
					{
						serializedObject.ApplyModifiedProperties();
						HandleDependenciesChanged(obj);
					}
				}
			}
			RenderMissingDependencies(obj);
		}

		private static void HandleDependenciesChanged(ExportInfo exp)
		{
			if (!PackageUtils.TryReadDependencies(exp.PackageJsonPath, out var dependencies)) return;

			var serializedDependencies = exp.Dependencies;

			var didChange = false;

			var current = wrapper.Dependencies;
			foreach (var dep in previouslyAssignedDependencies)
			{
				if (!dep) continue;
				if (!current.Contains(dep))
				{
					var bundle = dep.FindBundle();
					var packageName = bundle?.FindPackageName();
					if (packageName != null && dependencies.ContainsKey(packageName))
					{
						Debug.Log("<b>Remove dependency</b> to " + packageName + " from " + exp.DirectoryName + "\nin package " + exp.PackageJsonPath);
						didChange = true;
						dependencies.Remove(packageName);
						serializedDependencies.RemoveAll(d => d.Name == packageName);

						// remove the workspace path entries in the current project
						var dir = exp.GetProjectDirectory();
						if (WorkspaceUtils.TryReadWorkspace(dir, out var workspace))
						{
							if (WorkspaceUtils.RemoveFromFolders(workspace, packageName))
								WorkspaceUtils.WriteWorkspace(workspace, dir);
						}
					}
				}
			}

			foreach (var cur in current)
			{
				if (!cur) continue;
				var bundle = cur.FindBundle();
				if (bundle == null) continue;
				bundle.FilePath = AssetDatabase.GetAssetPath(cur);
				if (!previouslyAssignedDependencies.Contains(cur))
				{
					var packageName = bundle.FindPackageName();
					if (packageName != null)
					{
						if (!dependencies.ContainsKey(packageName))
						{
							Debug.Log("<b>Add dependency</b> to " + packageName + " to " + exp.DirectoryName + "\nin package " + exp.PackageJsonPath);
							didChange = true;
							var dir = bundle.PackageDirectory;
							var target = Path.GetFullPath(exp.GetProjectDirectory());
							var path = PackageUtils.GetFilePath(target, dir);
							dependencies.Add(packageName, path);

							if (WorkspaceUtils.TryReadWorkspace(target, out var workspace))
							{
								if (WorkspaceUtils.AddToFolders(workspace, packageName))
									WorkspaceUtils.WriteWorkspace(workspace, target);
							}

							bundle.RunInstall();
						}
					}
					else Debug.LogWarning("Could not find package name in " + bundle.PackageFilePath.AsLink());
				}

				TryAddDependenciesToSerializedList(serializedDependencies, cur);
			}

			previouslyAssignedDependencies.Clear();
			previouslyAssignedDependencies.AddRange(current);

			if (didChange)
			{
				PackageUtils.TryWriteDependencies(exp.PackageJsonPath, dependencies);
				TypesUtils.MarkDirty();
			}
		}

		private static bool TryAddDependenciesToSerializedList(List<Dependency> dependencies, NpmDefObject obj)
		{
			var bundle = obj.FindBundle();
			if (bundle == null) return false;
			var bundleName = bundle.FindPackageName();
			if (!dependencies.Any(d => d.Name == bundleName))
			{
				dependencies.Add(new Dependency
				{
					Name = bundleName,
					VersionOrPath = bundle.FilePath,
					Guid = AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(obj))
				});
			}
			return true;
		}

		private static bool MissingDependenciesFoldout
		{
			get => SessionState.GetBool("Needle_ExportInfoSerializedMissingDependencies", true);
			set => SessionState.SetBool("Needle_ExportInfoSerializedMissingDependencies", value);
		}

		private static readonly List<Dependency> MissingDependencies = new List<Dependency>();

		private static void RenderMissingDependencies(ExportInfo exp)
		{
			MissingDependencies.Clear();
			for (var index = 0; index < exp.Dependencies.Count; index++)
			{
				var dep = exp.Dependencies[index];
				if (dep.IsMissingNpmDef())
				{
					// try resolve from known npmdefs in project
					// this may happen if the npmdef was moved or renamed but the serialized dependency path wasnt updated
					var existing = BundleRegistry.Instance.Bundles.FirstOrDefault(b => b.FindPackageName() == dep.Name);
					if (existing != null)
					{
						dep.VersionOrPath = existing.FilePath;
						if (File.Exists(dep.VersionOrPath))
							dep.Guid = AssetDatabase.AssetPathToGUID(dep.VersionOrPath);
						exp.Dependencies[index] = dep;
					}
					else
						MissingDependencies.Add(dep);
				}
			}
			if (MissingDependencies.Count <= 0) return;

			// using (new ColorScope(Color.yellow))
			using (new EditorGUILayout.HorizontalScope())
			{
				GUILayout.Space(3);
				MissingDependenciesFoldout =
					EditorGUILayout.Foldout(MissingDependenciesFoldout, "Missing Dependencies (" + MissingDependencies.Count + ")");
			}
			if (!MissingDependenciesFoldout) return;
			EditorGUILayout.HelpBox(
				"These dependencies are missing npmdef files that are serialized in this component. You may remove them from the component by clicking the button below. This may happen if you share this scene across multiple projects or you removed the npmdef from your project.",
				MessageType.None);
			// EditorGUI.indentLevel++;
			for (var index = 0; index < exp.Dependencies.Count; index++)
			{
				var dep = exp.Dependencies[index];
				if (dep.IsMissingNpmDef())
				{
					using (new EditorGUILayout.HorizontalScope())
					{
						EditorGUILayout.LabelField(new GUIContent("Missing \"" + dep.Name + "\"", dep.VersionOrPath));
						if (GUILayout.Button("Remove", GUILayout.Width(80)))
						{
							if (EditorUtility.DisplayDialog("Remove dependency",
								    "Do you want to remove the serialized dependency to " + dep.Name + " ( " + dep.VersionOrPath + ")?", "Yes", "No"))
							{
								exp.Dependencies.RemoveAt(index--);

								if (exp.Dependencies.Any(d => d.Name != dep.Name) &&
								    PackageUtils.TryReadDependencies(exp.PackageJsonPath, out var dependencies))
								{
									dependencies.Remove(dep.Name);
									PackageUtils.TryWriteDependencies(exp.PackageJsonPath, dependencies);
								}
								Debug.Log("Removed missing dependency to \"" + dep.Name + "\" from " + exp.DirectoryName);
							}
							GUIUtility.ExitGUI();
						}
					}
				}
			}
			// EditorGUI.indentLevel--;
		}
	}
}