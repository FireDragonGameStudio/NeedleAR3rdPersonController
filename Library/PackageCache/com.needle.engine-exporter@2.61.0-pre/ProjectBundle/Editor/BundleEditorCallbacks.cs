using System;
using System.IO;
using System.Runtime.CompilerServices;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;

namespace Needle.Engine.ProjectBundle
{
	public class BundleEditorCallbacks : UnityEditor.AssetModificationProcessor
	{
		private static AssetDeleteResult OnWillDeleteAsset(string assetPath, RemoveAssetOptions options)
		{
			if (assetPath.EndsWith(Constants.Extension))
			{
				var basePath = Path.GetDirectoryName(assetPath) + "/" + Path.GetFileNameWithoutExtension(assetPath);
				var hiddenDir = basePath + "~";
				var codeGenDir = basePath + ".codegen";
				if (Directory.Exists(hiddenDir) || Directory.Exists(codeGenDir))
				{
					var res = EditorUtility.DisplayDialogComplex("Deleting NpmDef file",
						$"You are about to delete a npm definition file which contains assets in other folders. Do you want to delete linked folders to {Path.GetFileName(assetPath)} also? Make sure you have a backup, this action cannot be undone.\n\nLinked folders:\n{hiddenDir}\n{codeGenDir}",
						"Ok – Delete linked folders", "Cancel", "Only delete NpmDef file");
					switch (res) 
					{
						case 0: // ok
							if (Directory.Exists(hiddenDir))
							{
								Actions.DeleteRecursive(hiddenDir);
							}
							if (Directory.Exists(codeGenDir))
							{
								Directory.Delete(codeGenDir, true);
								File.Delete(codeGenDir + ".meta");
							}
							return AssetDeleteResult.DidNotDelete;
						case 1: // cancel:
							Debug.Log("Cancelled deleting " + assetPath);
							return AssetDeleteResult.DidDelete;
						case 2: // alt:
							break;
					}
				}
			}
			return AssetDeleteResult.DidNotDelete;
		}

		private static AssetMoveResult OnWillMoveAsset(string sourcePath, string destinationPath)
		{
			if (sourcePath.EndsWith(".codegen") && Directory.Exists(sourcePath))
			{
				var npmdefPath = sourcePath.Substring(0, sourcePath.Length - ".codegen".Length) + Constants.Extension;
				if (File.Exists(npmdefPath))
				{
					Debug.LogWarning("<b>Prevented move of codegen directory</b> because it is linked to the " + Path.GetFileName(npmdefPath) +
					                 " - please rename or move " + npmdefPath.AsLink() + " instead.");
					return AssetMoveResult.DidMove;
				}
			}

			// when moving a npmdef file
			if (sourcePath.EndsWith(Constants.Extension))
			{
				var sourcePathWithoutExtension = Path.GetDirectoryName(sourcePath) + "/" + Path.GetFileNameWithoutExtension(sourcePath);
				var hiddenDirPath = sourcePathWithoutExtension + "~";
				var hiddenFolder = new DirectoryInfo(hiddenDirPath);
				var targetFile = new FileInfo(destinationPath);
				if (hiddenFolder.Exists)
				{
					var targetPackageDirectory = targetFile.Directory!.FullName + "/" +
					                             Path.GetFileNameWithoutExtension(destinationPath) + "~";
					Debug.Log("Move directory from " + hiddenFolder.FullName + " to " + targetPackageDirectory);
					try
					{
						Directory.Move(hiddenFolder.FullName, targetPackageDirectory);
					}
					catch (Exception ex)
					{
						switch (ex)
						{
							case IOException _:
							case UnauthorizedAccessException _:
								Debug.LogWarning(
									"<b>Moving hidden directory failed</b>: preventing rename! The directory is probably locked by some process (e.g. an editor has a file opened or your server is running using this package).");
								break;
							default:
								Debug.LogException(ex);
								break;
						}
						// prevent rename if this fails
						return AssetMoveResult.DidMove;
					}
				}

				var codeGenPath = sourcePathWithoutExtension + ".codegen";
				if (Directory.Exists(codeGenPath))
				{
					var targetCodeGenDirectory = targetFile.Directory!.FullName + "/" +
					                             Path.GetFileNameWithoutExtension(destinationPath) + ".codegen";
					try
					{
						Directory.Move(codeGenPath, targetCodeGenDirectory);
						var metaSource = codeGenPath + ".meta";
						var metaTarget = targetCodeGenDirectory + ".meta";
						File.Move(metaSource, metaTarget);
					}
					catch (Exception ex)
					{
						switch (ex)
						{
							case IOException _:
							case UnauthorizedAccessException _:
								Debug.LogWarning(
									"<b>Moving codegen directory failed</b>: preventing rename! The directory is probably locked by some process (e.g. an editor has a file opened or your server is running using this package)");
								break;
							default:
								Debug.LogException(ex);
								break;
						}
						// prevent rename if this fails
						return AssetMoveResult.DidMove;
					}
				}

				// to update scripted importer
				var sel = Selection.activeObject;
				Selection.activeObject = null;
				EditorApplication.delayCall += () => Selection.activeObject = sel;
				
				AssetDatabase.ImportAsset(sourcePath);

				// ensure we collect all types again
				TypesUtils.MarkDirty();
				
				// ensure moved codegen folder is correctly updated in ui
				AssetDatabase.Refresh();
				EditorApplication.delayCall += AssetDatabase.Refresh;
			}

			return AssetMoveResult.DidNotMove;
		}

		[OnOpenAsset(100)]
		private static bool OpenAsset(int instanceID, int line)
		{ 
			if (EditorUtility.InstanceIDToObject(instanceID) is Typescript typescriptSubAsset)
			{
				Actions.OpenWorkspace(typescriptSubAsset.NpmDefPath);
				var path = Path.GetFullPath(typescriptSubAsset.Path);
				EditorUtility.OpenWithDefaultApp(path);
				return true;
			}
			
			var filePath = AssetDatabase.GetAssetPath(instanceID);
			if (filePath.EndsWith(Constants.Extension))
			{
				Actions.OpenWorkspace(filePath);
				return true;
			}

			return false;
		}
	}
}