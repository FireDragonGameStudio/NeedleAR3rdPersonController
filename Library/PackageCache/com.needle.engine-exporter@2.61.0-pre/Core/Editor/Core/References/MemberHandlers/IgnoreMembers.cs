using System;
using System.Collections.Generic;
using System.Reflection;
using JetBrains.Annotations;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Needle.Engine.Core.References.MemberHandlers
{
	[UsedImplicitly]
	public class IgnoreMembers : ITypeMemberHandler
	{
		private readonly List<(Type type, string name)> ignoredMembers = new List<(Type type, string name)>()
		{
			(typeof(Object), nameof(Object.name)),
			(typeof(Object), nameof(Object.hideFlags)),
			(typeof(Component), nameof(Component.tag)),
			(typeof(Renderer), nameof(Renderer.material)),
			(typeof(Renderer), nameof(Renderer.materials)),
			(typeof(Collider), nameof(Collider.material)),
			(typeof(MeshFilter), nameof(MeshFilter.mesh)),
			(typeof(Transform), nameof(Transform.forward)),
			(typeof(MonoBehaviour), nameof(MonoBehaviour.runInEditMode)),
			(typeof(MonoBehaviour), nameof(MonoBehaviour.useGUILayout)),
			(typeof(Canvas), nameof(Canvas.renderingDisplaySize)),
			(typeof(Camera), nameof(Camera.scene)),
			(typeof(Behaviour), nameof(Behaviour.isActiveAndEnabled)),
			(typeof(Transform), nameof(Transform.localToWorldMatrix)),
			(typeof(Transform), nameof(Transform.worldToLocalMatrix))
			// (typeof(Behaviour), nameof(Behaviour.enabled))
		};

		private static readonly Dictionary<(Type type, string name), bool> ignored = new Dictionary<(Type, string), bool>();

		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			var type = member.DeclaringType;
			if (type == null) return false;
			var key = (type, member.Name);
			if (ignored.TryGetValue(key, out var ignore)) return ignore;
			for (var index = 0; index < ignoredMembers.Count; index++)
			{
				var i = ignoredMembers[index];
				if (i.type.IsAssignableFrom(type) && i.name == member.Name)
				{
					ignored.Add(key, true);
					return true;
				}
			}
			ignored.Add(key, false);
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			return false;
		}
	}
}