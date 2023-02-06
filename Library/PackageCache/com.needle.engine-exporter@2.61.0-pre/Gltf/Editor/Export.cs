using System;
using System.IO;
using Needle.Engine.Core;
using Needle.Engine.Core.References.ReferenceResolvers;
using Needle.Engine.Projects;
using Needle.Engine.Utils;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	public static class Export
	{
		private static string GetTargetPath(string projectDirectory, Object obj, string extension)
		{
			return projectDirectory + "/assets/" + obj.name.ToFileName() + extension;
		}

		public static bool AsGlb(Object obj, out string path, bool force, string projectDirectory = null)
		{
			if (projectDirectory != null)
			{
				if (!Directory.Exists(projectDirectory))
				{
					Debug.LogError($"Can not export to {projectDirectory} because it does not exist.");
					path = null;
					return false;
				}
			}
			else
			{
				// If we are saving in a prefab we can try to get the path from the scene that might be still open
				var info = Object.FindObjectOfType<ExportInfo>();
				projectDirectory = Path.GetFullPath(info.GetProjectDirectory());
			}

			if (string.IsNullOrWhiteSpace(projectDirectory) || !Directory.Exists(projectDirectory))
			{
				if (ProjectsData.TryGetBuilderProjectInfo(out var proj))
				{
					projectDirectory = proj.ProjectPath;
				}
				else if (ProcessUtils.TryFindCurrentProjectDirectory(out var dir))
				{
					projectDirectory = dir;
				}
			}

			if (!string.IsNullOrEmpty(projectDirectory) && Directory.Exists(projectDirectory))
			{
				using var @lock = new NeedleLock(projectDirectory);
				
				var extension = ".glb";
				var targetFilePath = GetTargetPath(projectDirectory, obj, extension);
				var buildContext = BuildContext.LocalDevelopment;
				var ctx = new ObjectExportContext(buildContext, obj, projectDirectory, targetFilePath, extension);
				if (force || File.Exists(targetFilePath))
				{
					return AsGlb(ctx, obj, out path, null, force);
				}
			}

			path = null;
			return false;
		}

		public static bool AsGlb(IExportContext ctx, Object obj, out string path, object owner = null, bool force = false)
		{
			path = null;
			Action afterExport = default;
			try
			{
				if (ctx is ObjectExportContext objExport)
				{
					path = objExport.Path;
				}
				
				// TODO: move calculating the output path into this method
				
				// if (ctx.TryGetAssetDependencyInfo(obj, out var dep))
				// {
				// 	if (dep.HasChanged == false)
				// 	{
				// 		// TODO: check if the file needs to be exported
				// 	}
				// }

				var original = obj;
				
				if (!SceneExportUtils.TryGetInstanceForExport(obj, out var instance, out afterExport))
					return false;

				// For example when exporting some part of the hierarchy via context click
				var isRootExport = ctx.ParentContext == null;
				if (isRootExport || !instance.transform.parent)
				{
					if (!instance.TryGetComponent(out IExportableObject exp))
					{
						exp = new ExportableObject(instance.transform);
					}

					if (GltfReferenceResolver.ExportReferencedObject(owner, original, instance, exp, ctx, ref path, force))
					{
						return true;
					}
				}
			}
			finally
			{
				afterExport?.Invoke();
			}
			
			return false;
		}

		

		/// <summary>
		/// Used to export gltf from transforms without having to have a GltfObject component
		/// </summary>
		private class ExportableObject : IExportableObject
		{
			private readonly Transform root;

			public string name { get; set; }

			public ExportableObject(Transform root)
			{
				this.name = root.name;
				this.root = root;
			}

			public bool Export(string path, bool force, IExportContext context)
			{
				var handler = GltfExportHandlerFactory.CreateHandler();
				var task = handler.OnExport(root, path, context);
				var res = AsyncHelper.RunSync(() => task);
				return res;
			}
		}
	}
}