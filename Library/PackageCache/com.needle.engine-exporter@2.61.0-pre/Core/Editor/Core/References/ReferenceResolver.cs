#nullable enable
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Needle.Engine.Core.Converters;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.References
{
	/// <summary>
	/// has access to registered references and emits and assigns references in generated js file
	/// </summary>
	public class ReferenceResolver
	{
		private readonly ReferenceCollection data;
		private static IReferenceResolver[]? resolvers;
		public IWriter? CurrentWriter { get; private set; }
		public ExportContext? ExportContext { get; private set; }
		private readonly JavascriptConverter jsConverter = new JavascriptConverter(false);

		internal ReferencedField? CurrentField { get; private set; }

		internal ReferenceResolver(ReferenceCollection data)
		{
			this.data = data;
		}

		public void ResolveAndWrite(ICodeWriter writer, ExportContext context)
		{
			CurrentWriter = writer;
			ExportContext = context;
			previouslyResolved.Clear();

			writer.Write("");
			writer.Write("// RESOLVE REFERENCES ※\\(^o^)/※");
			var lastPath = default(string);
			for (var index = 0; index < data.Fields.Count; index++)
			{
				var field = data.Fields[index];
				CurrentField = field;
				var isMissing = !Resolve(field, context, out var assignment);
				var objIsNullOrMissing = field.Value == null || field.Value is Object obj && !obj;
				var gameObject = objIsNullOrMissing ? null : TryGetGameObject(field?.Value);
				if (!isMissing && gameObject && gameObject != null)
				{
					if (!TryGetPreviouslyResolveGameObjectPath(gameObject, out var goPath))
					{
						goPath = $"{gameObject.name}_{gameObject.GetId()}_obj".ToJsVariable();
						TryStorePreviouslyResolveGameObjectPath(gameObject, goPath);
						writer.Write($"const {goPath} = {assignment};");
						assignment = goPath;
						writer.Write($"if ({goPath}) {{");
						writer.Indentation++;
						writer.Write($"{goPath}.layers.set({gameObject.layer});");
						writer.Write($"{goPath}.visible = {(gameObject.activeInHierarchy ? "true" : "false")};");
						var goDataPath = $"{goPath}.userData";
						writer.Write($"{goDataPath}.layer = {ToJsValue(gameObject.layer)};");
						writer.Write($"{goDataPath}.name = {ToJsValue(gameObject.name)};");
						writer.Write($"{goDataPath}.tag = {ToJsValue(gameObject.tag)};");
						writer.Write($"{goDataPath}.hideFlags = {ToJsValue(gameObject.hideFlags)};");
						writer.Write($"{goDataPath}.{nameof(GameObject.activeSelf)} = {ToJsValue(gameObject.activeSelf)};");
						writer.Write($"{goDataPath}.static = {ToJsValue(gameObject.isStatic)};");
						writer.Write($"{goPath}.guid = \"{gameObject.transform.GetId()}\";");
						writer.Indentation--;
						writer.Write("}");
					}
					else assignment = goPath;
				}

				if (field == null) continue;
				var variable = $"{field.Path}";
				if (!string.IsNullOrEmpty(field.Name))
					variable += "." + field.Name;
				var line = $"{variable} = {assignment};";
				if (isMissing) line = $"// {line} <MISSING> ({field.Value?.GetType().Name})";
				if (lastPath != field.Path)
				{
					writer.Write("");
					writer.Write("// " + field.Path);
				}
				writer.Write(line);
				lastPath = field.Path;
			}

			CurrentField = null;
			CurrentWriter = null;
			ExportContext = null;
		}

		private GameObject? TryGetGameObject(object? obj)
		{
			if (obj == null) return null;
			var go = obj as GameObject;
			if (go) return go;
			var tr = obj as Transform;
			if (tr) return tr?.gameObject;
			return null;
		}

		private readonly Dictionary<GameObject, string> previouslyResolved = new Dictionary<GameObject, string>();

		private bool TryGetPreviouslyResolveGameObjectPath(GameObject go, out string path)
		{
			return previouslyResolved.TryGetValue(go, out path);
		}

		private void TryStorePreviouslyResolveGameObjectPath(GameObject go, string path)
		{
			if (!go) return;
			if (!previouslyResolved.ContainsKey(go))
				previouslyResolved[go] = path;
		}

		private string ToJsValue(object value)
		{
			if (jsConverter.TryConvertToJs(value, out var res)) return res;
			Debug.LogWarning("Js converter could not convert: " + value);
			return value.ToString();
		}

		private bool Resolve(ReferencedField field, ExportContext context, out string? assignment)
		{
			assignment = null;
			
			// resolvers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IReferenceResolver>().ToArray();
			// foreach (var resolver in resolvers)
			// {
			// 	if (resolver.TryResolve(this, data, field.Path, field.Value, out assignment))
			// 	{
			// 		return true;
			// 	}
			// }
			
			if (jsConverter.TryConvertToJs(field.Value, out assignment))
			{
			}
			else if (field.Value is CallInfo call)
			{
				TryResolveCall(this, data, field.Path, call, out assignment);
			}
			else
			{
				// resolve object reference
				if (TryFindReference(this, data, field, out var res))
					assignment = res;
			}
			var isMissing = assignment == null;
			return !isMissing;
		}

		public static bool TryResolveCall(ReferenceResolver rr,
			ReferenceCollection col,
			string currentPath,
			CallInfo call,
			out string assignment)
		{
			if (!string.IsNullOrWhiteSpace(call.MethodName))
			{
				// var comp = call.Target as Component;
				// var reference = FindReferenceInEvent(call.Target, comp.transform);
				if (TryFindReference(rr, col, currentPath, call.Target, out var path, true))
				{
					var arg = call.Argument;
					if (call.Argument is string) arg = "\"" + arg + "\"";
					if (call.Argument is bool b) arg = b ? "true" : "false";
					assignment = "new scripts.CallInfo(";
					assignment += $"function() {{ {path}?.{call.MethodName}({arg}); }}";
					assignment += ")";
					return true;
				}
			}
			assignment = null!; //= $"function() {{ console.warn(\"could not resolve function\"); }}";
			return false;
		}

		public static bool TryFindReference(ReferenceResolver rr, ReferenceCollection col, ReferencedField referencedField, out string? res)
		{
			return TryFindReference(rr, col, referencedField.Path, referencedField.Value, out res);
		}

		public static bool TryFindReference(ReferenceResolver rr, ReferenceCollection col, string currentPath, object? value, out string? res, bool isInEventFunction = false)
		{
			if (value == null)
			{
				res = null!;
				return false;
			}

			resolvers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IReferenceResolver>().ToArray();
			foreach (var resolver in resolvers)
			{
				if (resolver.TryResolve(rr, col, currentPath, value, out res))
				{
					return true;
				}
			}

			if (value is IList list)
			{
				var emitUnityEvent = value is CallInfo[];
				res = "";
				if (emitUnityEvent) res += "new scripts.EventList(";
				res += "[";
				var results = new List<string?>();
				foreach (var e in list)
				{
					TryFindReference(rr, col, currentPath, e, out var result);
					results.Add(result);
				}
				res += string.Join(", ", results);
				res += "]";
				if (emitUnityEvent) res += ")";
				return true;
			}
			if (value is GameObject go && go)
			{
				value = go.transform;
			}
			if (value is Transform t && t)
			{
				if (EditorUtility.IsPersistent(t.gameObject))
				{
					Debug.LogWarning("Prefab references are not yet supported");
					res = null;
					return false;
				}
				res = FindByObjectId(col, t, t);
				return true;
			}
			if (value is Component m)
			{
				res = FindScript(m, isInEventFunction);
				return true;
			} 
			if (value is CallInfo call)
			{
				return TryResolveCall(rr, col, currentPath, call, out res);
			}

			var type = value.GetType();
			for (var index = 0; index < col.References.Count; index++)
			{
				var p = col.References[index];
				if (p.Value == value && p.Type == type)
				{
					res = p.Path;
					return true;
				}
			}

			try
			{
				if (type.GetCustomAttribute(typeof(SerializableAttribute)) != null)
				{
					res = JsonUtility.ToJson(value);
					return true;
				}
			}
			catch (ArgumentException ex)
			{
				Debug.LogError("Serialization failed at " + value, value as Object);
				Debug.LogException(ex);
			}
			res = default;
			return false;
		}


		public static string FindScript(Component searched, bool isInEventFunction)
		{
			return $"engine.tryFindScript(\"{searched.GetId()}\", scriptsList)";
		}

		public static string FindByObjectId(ReferenceCollection col, Object obj, Transform transform)
		{
			if (!TryResolveGltfRoot(col, transform, out _, out var path))
			{
				// object is exported by us so we know the guid
				return $"engine.tryFindObject(\"{obj.GetId()}\", scene, true)";
			}
			// we now append the guid to the extras again so we should search by guid
			return $"engine.tryFindObject(\"{obj.GetId()}\", {path}, true)";

			// this is the original code for when we thought we can find objects by their name
			// var assignment = $"{path}.{FindByNameCall(col, obj)}";
			// return assignment;
		}

		public static bool TryResolveGltfRoot(ReferenceCollection col, Transform target, out IExportableObject? root, out string path)
		{
			var foundGltfButNoReference = default(object);
			root = null;
			do
			{
				if (target.TryGetComponent<IExportableObject>(out var gltf))
				{
					var referenced = col.References.FirstOrDefault(r => ReferenceEquals(r.Value, target));
					if (referenced != null)
					{
						root = gltf;
						path = referenced.Path;
						return true;
					}
					// it is possible that some object is marked as exportable inside another object. Then only the outermost is actually exported and has references, therefor wait until we arrived at the root and still didnt find another exportable object only then we have a bug here
					foundGltfButNoReference = gltf;
				}
				target = target.parent;
			} while (target);

			if (foundGltfButNoReference != null)
			{
				// if the gltf is marked as editor only it is ok
				if (foundGltfButNoReference is Component comp && (comp.CompareTag("EditorOnly") || comp.name.StartsWith("__")))
				{
					root = null!;
					path = null!;
					return false;
				}
				Debug.LogError("Found gltf that is not referenced: " + foundGltfButNoReference);
			}

			root = null!;
			path = null!;
			return false;
		}

		// public static string FindByNameCall(ReferenceCollection col, Object obj)
		// {
		// 	var name = obj.name;
		// 	if (obj is Transform t) obj = t.gameObject;
		// 	var remap = col.Renamed.FirstOrDefault(r => r.obj == obj);
		// 	if (!string.IsNullOrEmpty(remap.newName))
		// 	{
		// 		name = remap.newName;
		// 	}
		//
		// 	// "Rock.021
		// 	var gltfName = name.Replace(" ", "_").Replace(".", "");
		// 	return $"getObjectByName(\"{gltfName}\", true)";
		// }
	}
}