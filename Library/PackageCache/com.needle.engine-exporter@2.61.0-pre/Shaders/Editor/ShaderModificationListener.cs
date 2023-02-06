using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Experimental;
using UnityEngine;
using Task = System.Threading.Tasks.Task;

namespace Needle.Engine.Shaders
{
	public class ShaderModificationListener : AssetsModifiedProcessor
	{
		private class RegisteredShader
		{
			public readonly object caller;
			public readonly UnityEngine.Shader shader;
			public readonly string path;

			public RegisteredShader(object caller, UnityEngine.Shader shader)
			{
				this.caller = caller;
				this.shader = shader;
				this.path = AssetDatabase.GetAssetPath(shader);
			}
		}
		
		private static readonly List<RegisteredShader> registered = new List<RegisteredShader>();

		public static void Add(object caller, UnityEngine.Shader shader)
		{
			if (registered.Any(r => r.caller == caller && r.shader == shader)) return;
			registered.Add(new RegisteredShader(caller, shader));
		}

		public static void Remove(object caller)
		{
			registered.RemoveAll(r => r.caller == caller);
		}

		protected override async void OnAssetsModified(string[] changedAssets, string[] addedAssets, string[] deletedAssets, AssetMoveInfo[] movedAssets)
		{
			if (registered.Count <= 0) return;
			await Task.Delay(100);
			foreach (var path in changedAssets)
			{
				if (path.EndsWith(".shader") || path.EndsWith(".shadergraph"))
				{
					foreach (var reg in registered)
					{
						if (reg.path == path)
						{
							if (reg.caller is ShaderExportAsset ex)
							{
								Debug.Log("Shader changed: " + path, ex);
								ex.isDirty = true;
							}
						}
					}
				}
			}
		}
	}
}