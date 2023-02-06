using System;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class RendererMembers : ITypeMemberHandler
	{
		private static readonly string[] allowedRendererTypes = new[]
		{
			"enabled",
			"receiveShadows",
			"shadowCastingMode",
			"lightmapIndex",
			"lightmapScaleOffset",
			"allowOcclusionWhenDynamic",
			"probeAnchor",
			"reflectionProbeUsage",
			"sharedMaterials",
		};

		private static readonly string[] allowedParticleSystemRenderer =
		{
			"mesh",
			"meshCount",
			"supportsMeshInstancing",
			"sharedMaterial",
			"trailMaterial",
			"minParticleSize",
			"maxParticleSize",
			"normalDirection",
			"velocityScale",
			"cameraVelocityScale",
			"lengthScale",
			"sortMode",
			"renderMode",
			"alignment"
		};

		private static readonly string[] allowedSpriteRenderer =
		{
			"drawMode",
			"size",
			"color",
			"sharedMaterial",
			"sprite",
			"spriteIndex"
		};

		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			if (currentType == typeof(SpriteRenderer))
			{
				if (allowedSpriteRenderer.Contains(member.Name)) return false;
				return true;
			}
			
			else if (typeof(ParticleSystemRenderer).IsAssignableFrom(currentType))
			{
				if (!allowedParticleSystemRenderer.Contains(member.Name))
					return true;
			}

			else if (typeof(Renderer).IsAssignableFrom(currentType))
			{
				return !allowedRendererTypes.Contains(member.Name);
				// return member.Name == "material" || member.Name == "get_materials";
			}

			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = null;
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			// if (instance is ParticleSystemRenderer && value != null)
			// {
			// 	switch (member.Name)
			// 	{
			// 		case "mesh":
			// 			var mesh = value as Mesh;
			// 			if (mesh)
			// 			{
			// 				MeshResource.Add(mesh);
			// 				value = mesh.name;
			// 			}
			// 			break;
			// 		case "trailMaterial":
			// 		case "sharedMaterial":
			// 			var material = value as Material;
			// 			var mainTex = GetMainTexture(material);
			// 			if (mainTex)
			// 			{
			// 				TextureResource.Add(mainTex);
			// 				value = mainTex.name;
			// 				return true;
			// 			}
			// 			return true;
			// 		default:
			// 			return false;
			// 	}
			// }
			return false;
		}

		private static Texture GetMainTexture(Material material)
		{
			if (!material) return null;
			if (material.HasProperty("_BaseMap")) return material.GetTexture("_BaseMap");
			if (material.HasProperty("_MainTex")) return material.GetTexture("_MainTex");
			return null;
		}
	}
}