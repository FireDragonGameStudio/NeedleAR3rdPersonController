#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;

namespace Needle.Engine.Codegen
{
	public static class TypesGenerator
	{
		[MenuItem(Constants.MenuItemRoot + "/Internal/Generate types for component generator")]
		public static void GenerateTypesAndShow()
		{
			GenerateTypesFile(CodeGenTypesFile);
			EditorUtility.RevealInFinder(CodeGenTypesFile);
		}

		[InitializeOnLoadMethod]
		private static void Init()
		{
			CompilationPipeline.assemblyCompilationFinished += OnCompilationFinished;
		}

		private static void OnCompilationFinished(string arg1, CompilerMessage[] messages)
		{
			if (!DidGenerateTypes) return;
			foreach (var msg in messages)
			{
				if (msg.type == CompilerMessageType.Error && msg.file.Contains(".codegen"))
				{
					DidGenerateTypes = false;
					break;
				}
			}
		}

		private static bool DidGenerateTypes
		{
			get => SessionState.GetBool("NeedleEngine_DidGenerateTypes", false);
			set => SessionState.SetBool("NeedleEngine_DidGenerateTypes", value);
		}

		private static DateTime _lastTimeGeneratedTypes = DateTime.Now;
		private static int _lastSourceFileCount = -1;

		internal static void GenerateTypesIfNecessary()
		{
			var now = DateTime.Now;
			var timeSinceTypeGen = now - _lastTimeGeneratedTypes;
			if (DidGenerateTypes && timeSinceTypeGen.TotalSeconds < 120 && !PlayerAssembliesChanged())
			{
				return;
			}
			DidGenerateTypes = true;
			_lastTimeGeneratedTypes = now;
			Debug.Log($"Generate codegen types: <a href=\"{CodeGenTypesFile}\">{CodeGenTypesFile}</a>\nSourceFiles: {_lastSourceFileCount} \nTime since last update: {timeSinceTypeGen.TotalSeconds}");
			GenerateTypesFile(CodeGenTypesFile);
		}

		public static string CodeGenTypesFile => Application.dataPath + "/../Library/Needle/CodeGen/Types.json";

		private static readonly List<Type> defaultList = new List<Type>();
		private static Assembly[] _lastPlayerAssemblies;
		private static System.Reflection.Assembly[] _assembliesInCurrentDomain;

		private static bool PlayerAssembliesChanged()
		{
			var count = _lastPlayerAssemblies?.Sum(asm => asm.sourceFiles.Length) ?? 0;
			var changed = _lastSourceFileCount != count;
			return changed;
		}

		private static readonly Dictionary<string, List<Type>> _priorityLists = new Dictionary<string, List<Type>>()
		{
			{ "Needle", new List<Type>() },
			{ "Unity", new List<Type>() },
		};

		public static void GenerateTypesFile(string filePath)
		{
			defaultList.Clear();
			foreach (var list in _priorityLists.Values) list.Clear();

			var dir = Path.GetDirectoryName(filePath);
			if (dir == null) return;
			Directory.CreateDirectory(dir);
			var allTypes = new Dictionary<string, string>();

			_lastPlayerAssemblies = CompilationPipeline.GetAssemblies(AssembliesType.Player);
			_lastSourceFileCount = _lastPlayerAssemblies.Sum(asm => asm.sourceFiles.Length);
			
			var player = _lastPlayerAssemblies.ToLookup(a => a.name);
			_assembliesInCurrentDomain ??= AppDomain.CurrentDomain.GetAssemblies();
			foreach (var asm in _assembliesInCurrentDomain)
			{
				var name = asm.GetName().Name;
				if (name.Contains("UnityEngine") || name.Contains("Unity."))
				{
					// take it
				}
				else if (player.Contains(name) == false)
					continue;

				try
				{
					foreach (var type in asm.GetTypes())
					{
						if (type.IsVisible == false) continue;
						if (type.IsNotPublic) continue;
						// static types are abstract and sealed
						if (type.IsAbstract && type.IsSealed) continue;

						var fullName = type.FullName;
						if (string.IsNullOrEmpty(fullName)) continue;
						// ignore some types
						if (fullName.Contains("+") || fullName.Contains("<") || type.Name.Contains("`")) continue;

						var added = false;
						foreach (var kvp in _priorityLists)
						{
							if (added) break;
							var list_name = kvp.Key;
							if (fullName.IndexOf(list_name, StringComparison.OrdinalIgnoreCase) > -1)
							{
								added = true;
								kvp.Value.Add(type);
							}
						}
						if (!added) defaultList.Add(type);
					}
				}
				catch
				{
					// ignore
				}
			}

			foreach (TypeCode typeCode in Enum.GetValues(typeof(TypeCode)))
			{
				var type = Type.GetType($"System.{typeCode}");
				if (type != null && type.IsPrimitive)
				{
					switch (typeCode)
					{
						case TypeCode.Boolean:
							allTypes.Add("bool", type.FullName);
							break;
						case TypeCode.Int32:
							allTypes.Add("int", type.FullName);
							break;
						case TypeCode.Single:
							allTypes.Add("float", type.FullName);
							break;
						case TypeCode.String:
							allTypes.Add("string", type.FullName);
							break;
					}
					allTypes.Add(type.Name, type.FullName);
				}
			}

			foreach (var list in _priorityLists.Values)
			{
				foreach (var type in list)
				{
					if (allTypes.ContainsKey(type.Name) == false)
						allTypes.Add(type.Name, type.FullName);
				}
			}
			foreach (var type in defaultList)
			{
				if (!allTypes.ContainsKey(type.Name))
					allTypes.Add(type.Name, type.FullName);
			}

			var content = JsonConvert.SerializeObject(allTypes);
			File.WriteAllText(filePath, content);
		}
	}
}
#endif