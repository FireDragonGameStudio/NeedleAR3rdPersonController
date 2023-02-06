using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Needle.Engine.Core;
using Needle.Engine.Core.References.ReferenceResolvers;
using Needle.Engine.Gltf.Spritesheets;
using Needle.Engine.Utils;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.Events;
using UnityEngine.UI;
using UnityEngine.Video;
using Object = UnityEngine.Object;

namespace Needle.Engine.Gltf
{
	[Serializable]
	public class SerializedDictionary
	{
		public List<object> Keys = new List<object>();
		public List<object> Values = new List<object>();
	}

	public class GltfValueResolver : IValueResolver
	{
		public static IValueResolver Default = new GltfValueResolver();


		public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
		{
			// Debug.Log("RESOLVE: " + value);
			if (ctx is GltfExportContext context)
			{
				if (value == null || (value is Object o && !o))
				{
					value = null;
					return true;
				}

				if (value is LayerMask layerMask)
				{
					value = layerMask.value;
					return true;
				}

				context.Debug.WriteDebugReferenceInfo(instance, member.Name, value);

				if (value is IDictionary dict)
				{
					if (dict.Count <= 0) return true;
					var newDict = new SerializedDictionary();
					// var newDict = new Dictionary<object, object>();
					var keys = dict.Keys;
					foreach (var keyObj in keys)
					{
						var key = keyObj;
						var val = dict[key];
						TryGetValue(ctx, instance, member, ref key);
						TryGetValue(ctx, instance, member, ref val);
						newDict.Keys.Add(key);
						newDict.Values.Add(val);
					}
					value = newDict;
					return true;
				}

				if (value is IList list)
				{
					if (list.Count <= 0)
					{
						return true;
					}

					var recurse = list is Array;
					if (!recurse && value.GetType().IsConstructedGenericType)
					{
						var gen = value.GetType().GenericTypeArguments;
						foreach (var type in gen)
						{
							if (!type.IsPrimitive && typeof(string) != type)
							{
								recurse = true;
							}
						}
					}
					if (!recurse) return true;
					var newList = new object[list.Count];
					for (var i = 0; i < list.Count; i++)
					{
						var val = list[i];
						if (TryGetValue(ctx, instance, member, ref val))
						{
							newList[i] = val;
						}
					}
					value = newList;
					return true;
				}

				if (value is ImageReference img)
				{
					if (img.Texture)  
					{
						var path = AssetDatabase.GetAssetPath(img.Texture);
						var target = context.AssetsDirectory + "/" + Path.GetFileName(path);
						File.Copy(path, target, true);
						value = PathUtils.MakeRelative(context.ProjectDirectory + "/", target);
						return true;
					}
					return true;
				}

				if (value is Mesh mesh && mesh)
				{
					var id = context.Bridge.TryGetMeshId(mesh);
					if (id < 0)
					{
						context.Bridge.AddMesh(mesh);
						id = context.Bridge.TryGetMeshId(mesh);
					}
					value = id.AsMeshPointer(); // new JObject() { { "src", id.AsMeshPointer() } };
					return true;
				}

				if (value is Material mat && mat)
				{
					var id = context.Bridge.TryGetMaterialId(mat);
					if (id < 0)
					{
						context.Bridge.AddMaterial(mat);
						id = context.Bridge.TryGetMaterialId(mat);
					}
					value = id.AsMaterialPointer();
					return true;
				}
				
				if (value is Sprite sprite)
				{
					if (TryHandleExportSprite(instance, sprite, context, out var res))
					{
						value = res;
						return true;
					}
				}

				if (value is Texture tex && tex)
				{
					var id = context.Bridge.TryGetTextureId(tex);
					if (id < 0)
					{
						context.Bridge.AddTexture(tex);
						id = context.Bridge.TryGetTextureId(tex);
					}
					value = id.AsTexturePointer();
					return true;
				}

				if (value is Font font && font)
				{
					var style = FontStyle.Normal;
					if (instance is Text text) style = text.fontStyle;
					var outputPath = FontsHelper.TryGenerateRuntimeFont(context, font, style, context.AssetsDirectory, false, instance as Object);
					if (outputPath == null)
					{
						if (font)
							value = "font:" + font.name;
						else value = null;
						return true;
					}
					value = PathUtils.MakeRelative(context.ProjectDirectory + "/", Path.GetFullPath(outputPath));
					return true;
				}

				if (value is AnimationClip anim && anim)
				{
					var owner = default(Transform);
					
					if (instance is AnimatorOverrideController || instance is AnimatorController || instance is AnimatorState)
					{
						// TODO: we need a way to get the animator that was referencing the animator override controller
						return false;
					}
					
					if(instance is Component comp) owner = comp.transform;
					
					var id = context.Bridge.TryGetAnimationId(anim, owner);
					if (id < 0)
					{
						context.Bridge.AddAnimationClip(anim, owner?.transform, 1);
						id = context.Bridge.TryGetAnimationId(anim, owner);
					}
					value = id.AsAnimationPointer();
					return true;
				}

				if (value is AudioMixer mixer)
				{
					// TODO
					Debug.LogWarning("AudioMixer Export is not yet supported: " + instance, instance as Object);
					value = "mixer/" + mixer.GetId();
					return true;
				}

				if (value is UnityEngine.Shader shader)
				{
					return shader;
				}

				if (value is AudioClip clip)
				{
					var assetPath = AssetDatabase.GetAssetPath(clip);
					var filename = Path.GetFileName(assetPath);
					var targetFullPath = context.AssetsDirectory + "/" + filename;
					var rel = PathUtils.MakeRelative(context.ProjectDirectory,
						targetFullPath); // //new Uri(context.ProjectDirectory + "/").MakeRelativeUri(new Uri(context.AssetsDirectory)).ToString();
					if (!File.Exists(targetFullPath))
						File.Copy(assetPath, targetFullPath, false);

					value = rel; // "./" + rel + "/" + filename;
					return true;
				}

				if (value is VideoClip videoClip)
				{
					value = VideoResolver.ExportVideoClip(videoClip, context.AssetsDirectory);
					return true;
				}

				if (value is UnityEventBase evt)
				{
					var hasCalls = evt.TryFindCalls(out var calls);
					var eventList = new JObject();
					eventList.Add("type", "EventList");
					var array = new JArray();
					eventList.Add("calls", array);
					if (hasCalls)
					{
						foreach (var callEntry in calls)
						{
							if (callEntry == null) continue;
							var e = callEntry as object;
							if (TryGetValue(context, instance, member, ref e))
							{
								array.Add(e);
							}
						}
					}
					value = eventList;
					return true;
				}

				if (value is CallInfo call)
				{
					var node = new JObject();
					// TODO: get reference from store
					var targetId = call.Target.GetId();
					node.Add("target", new JValue(targetId));
					node.Add("method", new JValue(call.MethodName));
					var enabled = call.State != UnityEventCallState.Off;
					node.Add("enabled", new JValue(enabled));
					if (call.Argument != null)
					{
						if (TryGetValue(context, instance, member, ref call.Argument))
						{
							if (call.Argument is JToken token)
								node.Add("argument", token);
							else // if(call.Argument is bool) 
								node.Add("argument", new JValue(call.Argument));
							// else
							// 	node.Add("argument", call.Argument?.ToString());
						}
					}
					value = node;
					return true;
				}

				if (value is Color col)
				{
					if (instance is ParticleSystem.MinMaxGradient || instance is GradientColorKey)
					{
						value = ParticleSystemUtils.ToLinear(col);
						return true;
					}
				}

				// TODO: cleanup this logic mess. I think this is not in all cases correct and we should create tests for exporting persistent assets with various configurations. We have cases with prefabs and scenes where we need to correctly detect if a reference is actually an asset or just a reference within an asset
				if (value is Object obj)
				{
					// if (instance is Object ownerObject)
					// {
					// 	if (EditorUtils.IsCrossSceneReference(ownerObject, obj))
					// 	{
					// 		Debug.LogWarning("Found cross scene reference on " + ownerObject, ownerObject);
					// 		value = null;
					// 		return false;
					// 	}
					// }

					// persistent asset export:
					if (EditorUtility.IsPersistent(obj) && context.AssetExtension.CanAdd(instance, obj))
					{
						// if a component in a prefab root is referenced
						var exportAsset = false;

						// test against transform
						if (obj is GameObject gameObject) value = gameObject.transform;

						if ((value is Component comp && !(value is Transform) && !comp.transform.parent))
						{
							exportAsset = true;
							obj = comp.transform;

							// check if the component that references this component is in the same prefab
							if (instance is Component ownerComponent && ownerComponent.transform == comp.transform)
							{
								exportAsset = false;
							}
						}

						if (exportAsset || !(value is Component))
						{
							var serializedOrPath = context.AssetExtension.GetPathOrAdd(obj, instance, member);
							value = serializedOrPath;
							return true;
						}
					}
				}

				foreach (var rec in context.ValueResolvers)
				{
					if (rec == this) continue;
					if (rec.TryGetValue(context, instance, member, ref value))
						return true;
				}

				// URP lights are handled in URPLightHandler
				if (instance is Light)
				{
					switch (member.Name)
					{
						case "shadowBias":
							if (value is float shadowBias)
							{
								// invert factor since the effect in unity seems to work that wy
								// also add a little bias by default to reduce artifacts when using default settings
								value = shadowBias * .00001f * -1 + 0.000025f;
								return true;
							}
							break;
						case "shadowNormalBias":
							if (value is float normalBias)
							{
								value = normalBias * .01f;
								return true;
							}
							break;
					}
				}
				

				// handle reference to another node in the same glTF
				try
				{
					if (value is GameObject go) value = go.transform;
				}
				catch (MissingReferenceException)
				{
					Debug.LogWarning("Missing reference detected in " + member.Name + " on " + instance, instance as Object);
					return false;
				}
				
				if (value is Transform t)
				{
					// if this is the transform of the current object
					// we dont need to serialize a node id (its no reference)
					// but we want to serialize the transform component
					if (instance is Component component && value is RectTransform && ReferenceEquals(component.transform, value))
					{
						// TODO: we need to export rect transforms for canvas support in glbs but this does lead to circular reference errors just now
						return true;
					}

					var id = context.Bridge.TryGetNodeId(t);
					if (id >= 0)
					{
						value = "/nodes/" + id;//new JObject { { "node", new JRaw(id) } };
						return true;
					}
				}

				if (value is Object anyObj)
				{
					// if (context.References.TryFindReference(anyObj, out var reference))
					// {
					// 	value = reference.Path;
					// 	return true;
					// }

					// TBD: use extension component path at some point?!
					if (!(anyObj is Component))
						Debug.LogWarning($"Could not find node id for \"{value.GetType().Name}\", " +
						                 $"this means this is probably an external reference. This will probably only load and work within the context of this scene.",
							instance as Object);
					var guid = anyObj.GetId();
					value = new JObject { { "guid", new JValue(guid) } };
					return true;
				}
			}
			return true;
		}

		private bool TryHandleExportSprite(object owner, Sprite sprite, GltfExportContext exportContext, out object value)
		{
			// TODO: check if we export sprite sheets for every type we do not break UI
			if (owner is SpriteRenderer)
			{
				if(SpriteSheet.TryCreate(owner, sprite, exportContext, out var spriteSheet))
				{
					value = spriteSheet;
					return true;
				}
			}
			value = null;
			return false;
		}
	}
}