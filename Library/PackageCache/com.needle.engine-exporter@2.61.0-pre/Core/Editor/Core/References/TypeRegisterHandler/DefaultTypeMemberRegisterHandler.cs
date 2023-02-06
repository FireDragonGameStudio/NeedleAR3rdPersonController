#nullable enable

using System;
using System.Reflection;
using Needle.Engine.Interfaces;
using Needle.Engine.Settings;
using Needle.Engine.Utils;
using Unity.Profiling;
using UnityEngine;
using UnityEngine.Events;

namespace Needle.Engine.Core.References.TypeRegisterHandler
{
	[Priority(-1000)]
	public class DefaultTypeMemberRegisterHandler : ITypeMemberRegisterHandler
	{
		private static ITypeMemberHandler[]? memberHandlers;
		private static ITypeMemberHandlerLate[]? memberHandlersLate;

		private ProfilerMarker registerFields = new ProfilerMarker("Register Fields");
		private ProfilerMarker registerProperties = new ProfilerMarker("Register Properties");

		public virtual bool TryRegister(ReferenceRegistry reg, ReferenceCollection collection, string path, Component instance, Type type)
		{
			if (!reg.IsKnownType(type)) return false;

			memberHandlers ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypeMemberHandler>().ToArray();
			memberHandlersLate ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<ITypeMemberHandlerLate>().ToArray();

			var isDebugging = ExporterProjectSettings.instance.debugMode;

			foreach (var field in type.GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
			{
				using (registerFields.Auto())
				{
					if ((field.Attributes & (FieldAttributes.Private)) != 0)
					{
						if (field.GetCustomAttribute<SerializeField>() == null) continue;
					}

					if (field.Name != "transform")
					{
						if (IsBeingIgnored(type, field, memberHandlers)) continue;
					}
					var value = field.GetValue(instance);
					var name = field.Name;
					HandleRename(field, ref name);
					ReferenceExtensions.ToJsVariable(ref name);
					HandleValueChange(reg.Context, instance, field, field.FieldType, ref value, path);
					if (TryRegisterEventCall(reg, instance, path, name, value)) continue;
					var reference = new ReferencedField(instance, path, name, value);
					collection.Fields.Add(reference);
					PostRegister(reg.Context, instance, field, field.FieldType, ref value, path);
				}
			}

			foreach (var prop in type.GetProperties(BindingFlags.Instance | BindingFlags.Public))
			{
				if (!prop.CanRead) continue;
				using (registerProperties.Auto())
				{
					if (prop.Name != "transform")
					{
						if (IsBeingIgnored(type, prop, memberHandlers)) continue;
					}
					try
					{
						var value = prop.GetValue(instance);
						if (TryRegisterEventCall(reg, instance, path, prop.Name, value)) continue;
						var name = prop.Name;
						HandleRename(prop, ref name);
						ReferenceExtensions.ToJsVariable(ref name);
						HandleValueChange(reg.Context, instance, prop, prop.PropertyType, ref value, path);
						var reference = new ReferencedField(instance, path, name, value);
						collection.Fields.Add(reference);
						PostRegister(reg.Context, instance, prop, prop.PropertyType, ref value, path);
					}
					catch (TargetParameterCountException ex)
					{
						if (isDebugging)
							Debug.LogWarning("Failed at " + prop.Name + " in " + prop.DeclaringType + "\n" + ex);
					}
					catch (TargetInvocationException)
					{
						// some properties are obsolete
					}
				}
			}

			return true;
		}

		private bool IsBeingIgnored(Type type, MemberInfo member, ITypeMemberHandler[] handlers)
		{
			ITypeMemberHandler? ignorer = null;
			for (var index = 0; index < handlers.Length; index++)
			{
				var i = handlers[index];
				if (i.ShouldIgnore(type, member))
				{
					ignorer = i;
					break;
				}
			}
			if (ignorer != null) return true;
			return false;
		}

		public static bool TryRegisterEventCall(ReferenceRegistry reg, object instance, string path, string name, object value)
		{
			if (value is UnityEventBase evt)
			{
				if (evt.TryFindCalls(out var calls))
				{
					reg.RegisterEvent(path, instance, name, calls);
				}
				return true;
			}
			return false;
		}

		private void HandleRename(MemberInfo member, ref string name)
		{
			if (memberHandlers == null) return;
			foreach (var ig in memberHandlers)
			{
				if (ig.ShouldRename(member, out var newName))
				{
					name = newName;
					return;
				}
			}
		}

		private void HandleValueChange(IExportContext? context, Component instance, MemberInfo member, Type type, ref object value, string path)
		{
			if (memberHandlers == null) return;
			foreach (var ig in memberHandlers)
			{
				if (ig is IRequireExportContext req)
				{
					if (context == null)
						Debug.LogWarning("Missing context: " + ig);
					req.Context = context;
				}
				if (ig.ChangeValue(member, type, ref value, instance))
				{
					return;
				}
			}
		}

		private void PostRegister(IExportContext? context, Component instance, MemberInfo member, Type type, ref object value, string path)
		{
			if (memberHandlersLate == null) return;
			foreach (var ig in memberHandlersLate)
			{
				if (ig is IRequireExportContext req)
				{
					if (context == null)
						Debug.LogWarning("Missing context: " + ig);
					req.Context = context;
				}
				ig.PostRegisterField(member, type, ref value, instance, path);
			}
		}
	}
}