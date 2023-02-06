// using System;
// using System.Collections.Generic;
// using System.Diagnostics;
// using System.IO;
// using System.Linq;
// using System.Threading.Tasks;
// using Needle.Engine.Core;
// using Needle.Engine.Interfaces;
// using Needle.Engine.Settings;
// using Needle.Engine.Writer;
// using Newtonsoft.Json;
// using Debug = UnityEngine.Debug;
//
// namespace Needle.Engine.Shaders.MemberHandlers
// {
// 	public class ShaderExportHandler : IBuildStageCallbacks
// 	{
// 		private bool hasValid;
//
// 		public Task<bool> OnBuild(BuildStage stage, ExportContext context)
// 		{
// 			if (stage == BuildStage.PreBuildScene)
// 				OnPreBuild(context);
// 			else if (stage == BuildStage.PostBuildScene)
// 				OnPostBuild(context);
// 			return Task.FromResult(true);
// 		}
//
// 		private void OnPreBuild(ExportContext context)
// 		{
// 			hasValid = false;
// 			foreach (var reg in ShaderExporterRegistry.Registered)
// 			{
// 				if (reg.shader) hasValid = true;
// 				reg.Clear();
// 			}
// 			if (hasValid)
// 			{
// 				context.Writer.Write("import { shaders } from \"./shaders.js\"; // produced by " + nameof(ShaderExportHandler));
// 			}
// 		}
//
// 		private void OnPostBuild(ExportContext context)
// 		{
// 			if (!hasValid) return;
//
// 			var debug = ExporterProjectSettings.instance.debugMode;
// 			var exportedCount = 0;
//
// 			var watch = new Stopwatch();
// 			watch.Start();
//
// 			var exportedShaders = new List<ImportInfo>();
// 			var genDir = context.Project.GeneratedDirectory;
// 			var outDir = genDir + "/shaders/";
// 			if (debug) Debug.Log("Debug enabled: Outputting shaders to file");
// 			foreach (var asset in ShaderExporterRegistry.ExportCollection)
// 			{
// 				if (asset.IsUsingCustomPath) continue;
// 				if (!asset.IsBeingUsed()) continue;
//
// 				var skip = !debug && asset.smartExport && !asset.isDirty;
// 				if (skip) Debug.Log("<i>Skip exporting shader " + asset.name + " because it didnt change</i>", asset);
// 				asset.isDirty = false;
//
// 				var project = context.Project;
// 				var outputName = ShaderExporter.GetOutputName(asset.shader);
// 				var path = outDir + "/" + outputName + ".js";
// 				if (!File.Exists(path)) skip = false;
//
// 				ExtensionData data = default;
// 				var writeOutput = true;
// 				if (!skip)
// 				{
// 					writeOutput = asset.ExportNow(project.AssetsDirectory, out data, false, false);
// 					if (writeOutput)
// 					{
// 						Debug.Log("Exported shader " + asset.name, asset);
// 						exportedCount += 1;
// 					}
// 				}
//
// 				if (writeOutput)
// 				{
// 					if (debug && data != null)
// 					{
// 						foreach (var shaderVariant in data.shaders)
// 						{
// 							// when saving to file it is important that we prefix by shader name
// 							// otherwise shaders with the same keywords override each other
// 							var filePath = ShaderExporter.GetFileExportPath(asset.shader, shaderVariant, project.AssetsDirectory);
// 							ShaderExporter.ExportToFile(asset.shader, shaderVariant, project.AssetsDirectory);
// 							var rel = new Uri(project.ProjectDirectory + "/").MakeRelativeUri(new Uri(filePath));
// 							shaderVariant.uri = rel.ToString();
// 						}
// 					}
//
// 					string content = default;
// 					if (data != null) content = $"export const shader = " + JsonConvert.SerializeObject(data, Formatting.Indented);
// 					else if (File.Exists(path)) content = File.ReadAllText(path);
// 					if (!Directory.Exists(outDir)) Directory.CreateDirectory(outDir);
// 					if (!string.IsNullOrEmpty(content))
// 					{
// 						File.WriteAllText(path, content);
// 						exportedShaders.Add(new ImportInfo(outputName, path, content, null));
// 					}
// 					else Debug.LogError("Failed exporting shader " + outputName + " to " + path, asset);
// 				}
// 			}
//
// 			var shadersFilePath = genDir + "/shaders.js";
// 			var writer = new CodeWriter(shadersFilePath);
// 			foreach (var shader in exportedShaders)
// 			{
// 				writer.Write($"import {{ shader as {shader.TypeName} }} from \"./{shader.RelativeTo(shadersFilePath)}\";");
// 			}
// 			writer.Write("\nconst out = {");
// 			writer.Indentation += 1;
// 			writer.Write(string.Join(",\n", exportedShaders.Select(e => e.TypeName)));
// 			writer.Indentation -= 1;
// 			writer.Write("};\n");
// 			writer.Write("export { out as shaders }");
// 			writer.Flush();
//
// 			var elapsed = watch.Elapsed.TotalMilliseconds;
// 			watch.Stop();
//
// 			Debug.Log($"Exporting {exportedCount} shaders took {elapsed:0} ms");
// 		}
// 	}
// }