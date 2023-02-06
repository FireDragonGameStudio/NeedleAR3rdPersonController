using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using JetBrains.Annotations;
using Needle.Engine.Interfaces;
using Needle.Engine.Utils;

namespace Needle.Engine.ProjectBundle
{
	[UsedImplicitly]
	public class BundleTypeRegisterProvider : ITypeRegisterProvider
	{
		private static string GetCodeGenPath(Bundle bundle)
		{
			var codegenDir = bundle.PackageDirectory + "/codegen";
			Directory.CreateDirectory(codegenDir);
			var codegenPath = codegenDir + "/register_types.js";
			return codegenPath;
		}
		
		public void RegisterTypes(List<TypeRegisterInfo> infos, IProjectInfo pi)
		{
			var list = new List<ImportInfo>();
			foreach (var bundle in BundleRegistry.Instance.Bundles)
			{
				if (!bundle.IsInstalled(pi.PackageJsonPath)) continue;
				list.Clear();
				bundle.FindImports(list, pi.ProjectDirectory);
				var info = new TypeRegisterInfo(GetCodeGenPath(bundle), list.ToList());
				infos.Add(info);
				
			} 
		}

		public void GetTypeRegisterPaths(List<TypeRegisterFileInfo> paths, IProjectInfo pi)
		{
			foreach (var bundle in BundleRegistry.Instance.Bundles)
			{
				if (!bundle.IsInstalled(pi.PackageJsonPath)) continue;
				
				// if we have a main file we want to improt that
				if(PackageUtils.TryGetMainFile(bundle.PackageFilePath, out var mainFile))
				{
					var mainFilePath = bundle.PackageDirectory + "/" + mainFile;
					if (File.Exists(mainFilePath))
					{
						var rel = bundle.FindPackageName();
						var info = new TypeRegisterFileInfo()
						{
							RelativePath = rel,
							AbsolutePath = mainFilePath
						};
						paths.Add(info);
					}
				}
				
				var codegenPath = GetCodeGenPath(bundle);
				// codegen path
				if (File.Exists(codegenPath))
				{
					var packageDirectory = bundle.PackageDirectory + "/";
					var rel = bundle.FindPackageName() + "/" +  new Uri(packageDirectory).MakeRelativeUri(new Uri(codegenPath)).ToString();
					var info = new TypeRegisterFileInfo()
					{
						RelativePath = rel,
						AbsolutePath = codegenPath
					};
					paths.Add(info);
				}
			}
		}
	}	
}