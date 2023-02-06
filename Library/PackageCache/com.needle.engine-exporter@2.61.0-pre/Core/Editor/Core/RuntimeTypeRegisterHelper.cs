#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Interfaces;
using Needle.Engine.Projects;
using Needle.Engine.Utils;
using Needle.Engine.Writer;
using UnityEngine;

namespace Needle.Engine.Core
{
	/// <summary>
	/// Codegen to build type registry files - these are used to create known builtin components (e.g. from imported GLTFs)
	/// but could potentially also be used for "GetComponent" calls when using minification to resolve type by name/string
	/// </summary>
	[UsedImplicitly]
	public class RuntimeTypeRegisterHelper : IBuildStageCallbacks
	{
		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
		{
			if (stage == BuildStage.PreBuildScene)
			{
				var typeRegisterPaths = new List<TypeRegisterFileInfo>();
				using (new Timer("Export chunk type"))
				{
					UpdateProviderTypes(typeRegisterPaths, context);
				}

				using (new Timer("Export type registry"))
				{
					var outputPath = context.Project.GeneratedDirectory + "/register_types.js";
					var typeRegistryPath = context.Project.EngineDirectory + "/engine_typestore";
					var writer = new CodeWriter(outputPath);

					// TODO: we just import the whole register_types file here, we might potentially change that in the future to only import what is actually used(?!) or users need to manually import their types
					var importedPaths = new List<TypeRegisterFileInfo>();
					if (typeRegisterPaths.Count > 0)
					{
						writer.Write("// Import types from dependencies");
						foreach (var path in typeRegisterPaths)
						{
							if (File.Exists(path.AbsolutePath))
							{
								if (importedPaths.Any(p => p.RelativePath == path.RelativePath))
								{
									Debug.LogError("<b>Types already imported</b> from " + path.RelativePath +
									               "! This might be because you have multiple packages with the same name in your project. Please check your referenced .npmdef files!\n" +
									               string.Join("\n", importedPaths.Select(i => i.AbsolutePath)));
									continue;
								}
								importedPaths.Add(path);
								writer.Write("import \"" + path.RelativePath + "\"");
							}
						}
						writer.Write("");
					}

					RegisterTypes(writer, new string[] { context.Project.ScriptsDirectory }, outputPath, typeRegistryPath, out _);

					// register engine types
					// TODO: we might want to do this separately and not in some OnBuild callback
					if (PackageUtils.IsMutable(Constants.RuntimeNpmPackagePath))
					{
						var engineDir = context.Project.EngineDirectory + "/codegen";
						if (!Directory.Exists(engineDir)) Directory.CreateDirectory(engineDir);
						var engineTypes = engineDir + "/register_types.js";
						writer.Clear();
						writer.FilePath = engineTypes;
						RegisterTypes(writer,
							new[] { context.Project.EngineComponentsDirectory, context.Project.ExperimentalEngineComponentsDirectory },
							engineTypes, typeRegistryPath, out var engineImports);
						if (engineImports.Count <= 0)
						{
							Debug.LogError("No engine types found!");
							return Task.FromResult<bool>(false);
						}
						const string exportCodeGenFile = "components";
						var componentExportPath = context.Project.EngineComponentsDirectory + "/codegen/" + exportCodeGenFile + ".ts";
						var exportBasePath = Path.GetDirectoryName(componentExportPath);
						if (!Directory.Exists(exportBasePath))
						{
							Debug.LogError("Directory " + exportBasePath + " does not exist");
							return Task.FromResult<bool>(false);
						}
						var exportsContent = new StringWriter();
						// var exportedFiles = new HashSet<string>();
						exportsContent.WriteLine("// Export types");
						// this is just a test to maybe fix "exports.ts is not a module"
						exportsContent.WriteLine("export class __Ignore {}");
						foreach (var import in engineImports)
						{
							if(import.FilePath.LastIndexOf("\\engine-components\\", StringComparison.OrdinalIgnoreCase) > 0)
							{
								var fileName = Path.GetFileNameWithoutExtension(import.FilePath);
								if (fileName != exportCodeGenFile)
								{
									// exportedFiles.Add(fileName);
									var rel = PathUtils.MakeRelative(exportBasePath, import.FilePath, false);
									// remove file extension
									rel = rel.Substring(0, rel.Length - 3);
									exportsContent.WriteLine("export { " + import.TypeName + " } from \"" + rel + "\";");
								}
							}
						}
						File.WriteAllText(componentExportPath, exportsContent.ToString());
					}
				}
			}
			return Task.FromResult<bool>(true);
		}

		private static ITypeRegisterProvider[] _typeRegisterProviders;

		public void UpdateProviderTypes(List<TypeRegisterFileInfo> typeRegisterFilePaths, IProjectInfo ctx)
		{
			_typeRegisterProviders ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypeRegisterProvider>().ToArray();
			var engineTypeStorePath = Constants.RuntimeNpmPackageName + "/engine/engine_typestore";
			var infos = new List<TypeRegisterInfo>();
			foreach (var prov in _typeRegisterProviders)
			{
				infos.Clear();
				prov.RegisterTypes(infos, ctx);
				prov.GetTypeRegisterPaths(typeRegisterFilePaths, ctx);
				foreach (var i in infos)
				{
					var path = i.RegisterTypesPath;
					var writer = new CodeWriter(path);
					RegisterTypes(writer, i.Types, path, engineTypeStorePath);
				}
			}
		}

		public void RegisterTypes(CodeWriter writer,
			IEnumerable<string> scriptsDirectories,
			string outputFilePath,
			string pathToRegistryFile,
			out List<ImportInfo> imports)
		{
			// var importsGenerator = new ImportsGenerator();
			imports = new List<ImportInfo>();
			foreach (var dir in scriptsDirectories)
				TypeScanner.FindTypes(dir, imports);
			imports = imports
				.Where(i => File.Exists(i.FilePath))
				.OrderBy(i => i.TypeName)
				.ToList();
			RegisterTypes(writer, imports, outputFilePath, pathToRegistryFile);
		}

		public void RegisterTypes(CodeWriter writer, IList<ImportInfo> imports, string outputFilePath, string pathToRegistryFile)
		{
			string rel = default;
			// when generating typestore IN package we need to build a relative path
			if (outputFilePath.Contains("node_modules/" + Constants.RuntimeNpmPackageName))
				rel = "./" + new Uri(outputFilePath).MakeRelativeUri(new Uri(pathToRegistryFile));
			// when generating typestore in project we just import the package
			else rel = Constants.RuntimeNpmPackageName;
			ExportTypes(outputFilePath, writer, imports, rel);
			writer.Flush();
		}

		public void ExportTypes(string outputFilePath, ICodeWriter writer, IList<ImportInfo> types, string typeStoreRelativePath)
		{
			if (types.Count <= 0)
			{
				return;
			}


			writer.Write($"import {{ TypeStore }} from \"{typeStoreRelativePath}\"");
			
			// var isBuiltIn = ProjectPaths.NpmPackageDirectory != null && outputFilePath.Contains(Constants.RuntimeNpmPackageName);
			// if (isBuiltIn)
			// {
			// 	writer.Write($"import {{$BuiltInTypeFlag}} from \"{typeStoreRelativePath}\"");
			// }

			writer.Write("\n// Import types");
			var imported = new Dictionary<string, int>();
			var typeNames = new List<(string type, string name)>();
			foreach (var type in types)
			{
				if (type.ShouldIgnore) continue;
				if (!type.IsInstalled) continue;
				var name = type.TypeName;
				if (imported.TryGetValue(name, out var count))
				{
					count += 1;
					imported[name] = count;
					name += "_" + count;
				}
				else imported.Add(name, 0);
				typeNames.Add((name, type.TypeName));
				var str = ImportsGenerator.WriteImport(type, outputFilePath, name);
				writer.Write(str);
				// imported.Add(name);
				// if(isBuiltIn)
				// 	writer.Write(type.TypeName + "[$BuiltInTypeFlag] = true;\n");
			}

			writer.Write("\n// Register types");
			foreach (var type in typeNames)
			{
				writer.Write($"TypeStore.add(\"{type.name}\", {type.type});");
			}
		}
	}
}
#endif