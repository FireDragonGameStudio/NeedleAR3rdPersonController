#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.References
{
	public class ReferenceCollection
	{
		public readonly ReferenceRegistry Registry;
		public readonly List<ReferencedField> Fields = new List<ReferencedField>();
		public readonly List<ReferencedInstance> References = new List<ReferencedInstance>();
		public readonly List<(Object obj, string newName)> Renamed = new List<(Object obj, string newName)>();

		public ReferenceCollection(ReferenceRegistry registry)
		{
			Registry = registry;
		}
	}

	/// <summary>
	/// Used to register emitted js objects and paths + register fields
	/// </summary>
	public class ReferenceRegistry : IReferenceRegistry, ITypeRegistry
	{
		public bool TryGetPath(object? value, out string path)
		{
			path = null!;
			if (value == null) return false;
			var res = collection.References.FirstOrDefault(r => r.Value == value)?.Path;
			if (res == null) return false;
			path = res;
			return true;
		}

		public void RegisterReference(string path, object? value)
		{
			if (value == null) return;
			collection.References.Add(new ReferencedInstance(value, path, value.GetType()));
		}

		public void RegisterMembers(string path, Component c)
		{
			var type = c.GetType();
			typeHandlers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypeMemberRegisterHandler>().ToArray();
			foreach (var handler in typeHandlers)
			{
				if (handler.TryRegister(this, collection, path, c, type))
				{
					return;
				}
			}
		}

		public void RegisterField(string path, object owner, string? name, object? value)
		{
			var field = new ReferencedField(owner, path, name, value);
			collection.Fields.Add(field);
		}

		public void RegisterEvent(string path, object owner, string name, CallInfo[] info)
		{
			if (collection.Fields.Any(f => f.Path == path && f.Name == name))
			{
				if (ExporterProjectSettings.instance.debugMode)
					Debug.LogWarning($"Event is already registered: {path}.{name}");
				return;
			}
			var field = new ReferencedField(owner, path, name, info);
			collection.Fields.Add(field);
		}

		public void RegisterRemap(Object obj, string newName)
		{
			collection.Renamed.Add((obj, newName));
		}

		public void ResolveAndWrite(ICodeWriter writer, ExportContext context)
		{
			resolver.ResolveAndWrite(writer, context);
		}

		public bool IsKnownType(Type type)
		{
			return knownTypeNames.Contains(type.Name); // knownTypes.Any(t => t.TypeName == type.Name);
		}

		public void AddKnownType(string name)
		{
			if (!knownTypeNames.Contains(name))
				this.knownTypeNames.Add(name);
		}

		public bool TryFindReference(object? value, out IReference reference)
		{
			if (value != null)
			{
				foreach (var r in collection.References)
				{
					if (r.Value == value)
					{
						reference = r;
						return true;
					}
				}
			}
			reference = null!;
			return false;
		}

		public IReadOnlyList<IReference> References => collection.Fields;
		public IReadOnlyList<IImportedTypeInfo> KnownTypes => this.knownTypes;
		private readonly Dictionary<string, IImportedTypeInfo> knownTypesDict;

		public bool IsInstalled(Type type)
		{
			if (TryGetImportedTypeInfo(type, out var ti)) return ti.IsInstalled;
			return false;
		}

		public bool TryGetImportedTypeInfo(Type type, out IImportedTypeInfo info)
		{
			return knownTypesDict.TryGetValue(type.Name, out info);
		}

		public IExportContext? Context { get; set; }

		private readonly ReferenceCollection collection;
		private readonly HashSet<string> knownTypeNames = new HashSet<string>();
		private readonly IReadOnlyList<IImportedTypeInfo> knownTypes;
		private readonly ReferenceResolver resolver;
		private ITypeMemberRegisterHandler[]? typeHandlers;

		public ReferenceRegistry(IReadOnlyList<IImportedTypeInfo>? knownTypes)
		{
			this.collection = new ReferenceCollection(this);
			this.resolver = new ReferenceResolver(collection);
			this.knownTypes = knownTypes ?? Array.Empty<IImportedTypeInfo>();
			knownTypesDict = new Dictionary<string, IImportedTypeInfo>();

			knownTypeNames.Clear();
			if (knownTypes != null)
			{
				foreach (var t in knownTypes)
				{
					if (!knownTypeNames.Contains(t.TypeName))
						knownTypeNames.Add(t.TypeName);
					if (!knownTypesDict.ContainsKey(t.TypeName))
						knownTypesDict.Add(t.TypeName, t);
				}
			}
		}
	}

	// TODO: refactor - these should/can all be ReferencedVariable/Member types
	public class ReferencedVariable : IReference
	{
		public string Path { get; set; }
		public object? Value { get; set; }
		public Type? Type { get; set; }
		public object? Owner { get; set; }
		public string? Name { get; set; }


		public ReferencedVariable(string path, object? value, Type? type)
		{
			Path = path;
			Value = value;
			Type = type;
		}
	}

	public class ReferencedInstance : ReferencedVariable
	{
		public ReferencedInstance(object value, string path, Type type) : base(path, value, type)
		{
		}
	}

	public class ReferencedField : ReferencedVariable
	{
		public ReferencedField(object owner, string path, string? name, object? value) : base(path, value, null)
		{
			this.Owner = owner;
			this.Name = name;
		}
	}
}