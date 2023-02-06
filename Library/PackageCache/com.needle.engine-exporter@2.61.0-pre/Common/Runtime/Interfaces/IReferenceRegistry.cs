#nullable enable

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Needle.Engine
{
	public interface IReference
	{
		string Path { get; }
		object? Value { get; }
		Type? Type { get; }
		object? Owner { get; }
		string? Name { get; }
	}

	public interface IReferenceRegistry
	{
		void RegisterReference(string path, object? value);
		void RegisterMembers(string path, Component comp);
		void RegisterField(string path, object owner, string? name, object? value);
		void RegisterEvent(string path, object owner, string name, CallInfo[] info);
		bool TryFindReference(object? value, out IReference reference);

		IReadOnlyList<IReference> References { get; }
	}

	public interface IImportedTypeInfo
	{
		string TypeName { get; }
		string FilePath { get; }
		bool IsInstalled { get; }
	}

	public interface ITypeRegistry
	{
		bool IsKnownType(Type type);
		void AddKnownType(string typeName);
		IReadOnlyList<IImportedTypeInfo> KnownTypes { get; }
		bool IsInstalled(Type type);
		bool TryGetImportedTypeInfo(Type type, out IImportedTypeInfo info);
	}

	public static class ITypeRegistryExtensions
	{
		private static readonly List<Component> buffer = new List<Component>();
		public static IList<Component>? GetKnownComponents(this GameObject obj, ITypeRegistry reg)
		{
			buffer.Clear();
			obj.GetComponents(buffer);
			reg.FilterKnown(buffer);
			if (buffer.Count > 0)
			{
				return new List<Component>(buffer);
			}
			return null;
		}
		
		public static IList<T> FilterKnown<T>(this ITypeRegistry reg, IList<T> elements) where T : class
		{
			for (var i = elements.Count-1; i >= 0; i--)
			{
				var el = elements[i];
				if (el == null || !reg.IsKnownType(el.GetType()))
					elements.RemoveAt(i);
			}
			return elements;
		}
	}
}