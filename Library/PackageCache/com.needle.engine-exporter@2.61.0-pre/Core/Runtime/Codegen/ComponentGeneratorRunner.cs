using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Codegen
{
	public class ComponentGeneratorRunner
	{
		public bool debug = false;
		
		private static DateTime lastNodeJsWarningLogTime = DateTime.MinValue;
		
		public async Task<bool> Run(string generatorDir, string filePath, string targetDirectory, string seed)
		{
#if UNITY_EDITOR
			if (filePath == null || (!filePath.EndsWith(".ts") && !filePath.EndsWith(".js"))) return false;
			if (!File.Exists(filePath)) return false; 
			
			var typesInFile = new List<ImportInfo>();
			TypeScanner.FindTypesInFile(filePath, typesInFile);
			var expectedScriptTypesThatDontExistYet = new List<string>();
			foreach (var i in typesInFile)
			{
				var scriptPath = targetDirectory + "/" + i.TypeName + ".cs";
				if(!File.Exists(scriptPath))
					expectedScriptTypesThatDontExistYet.Add(scriptPath);
			}
			
			var logPath = $"{Application.dataPath}/../Temp/component-compiler.log";

			if (!await ProcessHelper.RunCommand("node --version", null, logPath, true, false))
			{
				var timeSinceLastLog = DateTime.Now - lastNodeJsWarningLogTime;
				if (timeSinceLastLog.TotalSeconds > 5)
				{
					lastNodeJsWarningLogTime = DateTime.Now;
					Debug.LogWarning("Detected script change but Node.js is not installed or could not be found. Please install Node.js to enable automatic C# code generation.");
				}
				return false;
			}
			
			var cmd = $"node component-compiler.js \"{Path.GetFullPath(targetDirectory)}\"";
			cmd += " \"" + Path.GetFullPath(filePath) + "\"";
			
			var logLink = $"<a href=\"{logPath}\">{logPath}</a>";
			var workingDir = Path.GetFullPath(generatorDir);

			TypesGenerator.GenerateTypesIfNecessary();
			var typesFilePath = TypesGenerator.CodeGenTypesFile;
			if (File.Exists(typesFilePath)) File.Copy(typesFilePath, workingDir + "/types.json", true);
			
			Debug.Log( $"<b>Run codegen</b> for {Path.GetFileName(filePath)} at <a href=\"{filePath}\">{filePath}</a>\n\n<b>Command</b>: <i>{cmd}</i>\n\n<b>Directory</b>: {workingDir}\n\n<b>Log at</b>: {logLink}");
			Directory.CreateDirectory(targetDirectory);
			
			ComponentGeneratorUtil.EnsureAssemblyDefinition(targetDirectory);

			if (debug) cmd += " & pause";
			
			if (await ProcessHelper.RunCommand(cmd, workingDir, logPath, !debug, debug))
			{
				TypesUtils.MarkDirty();
				AssetDatabase.Refresh();
				foreach (var exp in expectedScriptTypesThatDontExistYet)
				{
					// the script didnt exist before but does now
					if (File.Exists(exp))
					{
						var guid = ComponentGeneratorUtil.GenerateAndSetStableGuid(exp, seed);
						if(!string.IsNullOrEmpty(guid))
							Debug.Log(Path.GetFileName(exp) + ": " + guid);
					}
				}
				await Task.Delay(100);
				AssetDatabase.Refresh();
				return true;
			}
			
			Debug.LogWarning("Compilation failed, see log for more info: " + logLink);
#else
			await Task.CompletedTask;
#endif
			return false;
		}
	}
}