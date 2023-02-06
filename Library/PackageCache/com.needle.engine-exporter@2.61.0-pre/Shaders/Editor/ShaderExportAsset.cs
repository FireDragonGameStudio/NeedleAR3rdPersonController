using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

// see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_techniques_webgl

namespace Needle.Engine.Shaders
{
	// [CreateAssetMenu(menuName = Constants.MenuItemRoot + "/Shader Export")]
	public class ShaderExportAsset : ScriptableObject
	{
		public bool enabled = true;

		[Header("Shader")] public UnityEngine.Shader shader;
		public int subshaderIndex = 0;
		public int passIndex = 0;
		public bool collectOpenSceneVariants = false;
		public string customPath = "";

		public bool IsUsingCustomPath => !string.IsNullOrWhiteSpace(customPath);

		[Header("Export Settings")] public string outputDir = "../vite-sample/assets";
		public ShaderExporter.Mode mode = ShaderExporter.Mode.WebGL2;
		public bool postProcess = true;
		public bool exportShadersAsFiles = false;
		public bool openAfterExport = true;
		public bool exportOnSave = false;
		public bool smartExport = true;

		[Header("Output")] public ExtensionData KHR_techniques_webgl;

		private readonly ShaderExporter exporter = new ShaderExporter();
		private readonly ThreeShaderPostProcessor postProcessor = new ThreeShaderPostProcessor();

		[HideInInspector] public bool isDirty = true;
		[HideInInspector, SerializeField] private UnityEngine.Shader previouslyAssignedShader;

		private void OnValidate()
		{
			if (shader != previouslyAssignedShader)
				isDirty = true; 
			previouslyAssignedShader = shader;
			ShaderModificationListener.Remove(this);
			ShaderModificationListener.Add(this, shader);
		}

		private void OnEnable()
		{
			ShaderExporterRegistry.Register(this);
		}

		private void OnDestroy()
		{
			ShaderExporterRegistry.Unregister(this);
		}

		[ContextMenu("Export Shader")]
		public void ExportNow()
		{
			exporter.Clear();

			for (int i = 0; i < SceneManager.sceneCount; i++)
			{
				foreach (var go in SceneManager.GetSceneAt(i).GetRootGameObjects())
				{
					// collect MeshRenderer that have a material with this shader and a MeshFilter with a valid mesh and are not EditorOnly
					var validMaterials = go
						.GetComponentsInChildren<Renderer>()
						.Where(x => x.TryGetComponent<MeshFilter>(out var mf) && mf.sharedMesh)
						.SelectMany(x => x.sharedMaterials)
						.Where(x => x && x.shader == shader);

					foreach (var mat in validMaterials)
						exporter.Add(mat);
				}
			}

			ExportNow(outputDir, out KHR_techniques_webgl, this.exportShadersAsFiles, this.openAfterExport);
		}

		private string GetShaderDataPathRelative()
		{
			if (!shader) return null;
			var shaderName = $"{shader.GetNameWithoutPath()}.shaderdata";
			return shaderName;
		}

		public void Clear() => exporter.Clear();
		public int Add(Material mat) => exporter.Add(mat);

		public bool IsBeingUsed() => exporter?.IsBeingUsed(this.shader) ?? false;

		public bool GetData(out ExtensionData data)
		{
			return ExportNow(null, out data, false, false);
		}

		public bool ExportNow(string outputDirectory, out ExtensionData data, bool doExportShadersAsFiles, bool openFileAfterExport = false)
		{
			data = null;
			if (!shader)
			{
				Debug.LogError("No Shader assigned", this);
				return false;
			}

			exporter.GetData(shader, subshaderIndex, passIndex, mode, out data);

			if (postProcess)
				postProcessor.PostProcessShaders(data);

			if (doExportShadersAsFiles)
			{
				foreach (var shaderVariant in data.shaders)
				{
					ShaderExporter.ExportToFile(shader, shaderVariant, outputDirectory);
				}

				if (!Directory.Exists(outputDirectory)) Directory.CreateDirectory(outputDirectory);
				var serializedString = JsonConvert.SerializeObject(data, Formatting.Indented);
				var fileName = $"{outputDirectory}/{GetShaderDataPathRelative()}";
				File.WriteAllText(fileName, serializedString);
				if (openFileAfterExport)
					EditorUtility.OpenWithDefaultApp(fileName);
				else Debug.Log("Saved output to <a href=\"" + fileName + "\">" + fileName + "</a>");
			}

			return data != null;
		}
	}
}