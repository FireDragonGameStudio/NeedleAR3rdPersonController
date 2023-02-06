using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Needle.Engine.Utils;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;
using UnityEngine.UIElements;

namespace Needle.Engine.Samples.Helpers
{
    [CustomEditor(typeof(SampleCollection))]
    internal class SampleCollectionEditor : Editor
    {
        public override VisualElement CreateInspectorGUI()
        {
            var root = new VisualElement();
            
            // check if we're in dev mode
            // var path = Path.GetFullPath("Assets");
            // var parentDir = Path.GetDirectoryName(Path.GetDirectoryName(path))!.Replace("\\", "/");
            var isDevMode = PackageUtils.IsMutable(Engine.Constants.ExporterPackagePath);

            if (isDevMode)  
            {
                root.Add(new Button(() =>
                {
                    ProduceSampleArtifacts();
                }) { text = "Update Samples Artifacts", tooltip = "Creates samples.json and Samples.md in the repo root with the current sample data.\nAlso bumps the Needle Exporter dependency in the samples package to the current."});
                root.Add(new Button(() =>
                {
                    ExportLocalPackage();
                }) { text = "Export Local Package .tgz", tooltip = "Outputs the Samples package as immutable needle-engine-samples.tgz.\nThis is referenced by Tests projects to get the same experience as installing the package from a registry." });
            }
            
            root.Add(new Button(() =>
            {
                EditorWindow.GetWindow<SamplesWindow>().Show();
            }) { text = "Open As Window" });
            var v = new VisualElement();
            root.Add(v);
            var activeInspector = Resources.FindObjectsOfTypeAll<EditorWindow>()
                .FirstOrDefault(x => x.GetType().Name == "InspectorWindow");
            SamplesWindow.RefreshAndCreateSampleView(v, activeInspector);
            
            return root;
        }
        
        public static async void ProduceSampleArtifacts(List<SampleInfo> sampleInfos = null)
        {
            sampleInfos ??= SamplesWindow.GetLocalSampleInfos();
            
            // produce JSON
            var rootPath = "../../";
            var jsonPath = rootPath + "samples.json";
            var readmePath = rootPath + "Samples.md";
            var sc = CreateInstance<SampleCollection>();
            sc.samples = sampleInfos;
            var serializerSettings = SerializerSettings.Get();
            File.WriteAllText(jsonPath, JsonConvert.SerializeObject(sc, Formatting.Indented, serializerSettings));
            
            // produce markdown
            var readme = new List<string>();
            readme.Add("# Samples");
            readme.Add("");
            readme.Add("This is a list of all samples in this package. You can also find them in the Unity Package Manager window.");
            readme.Add("");
            readme.Add("## Samples");
            readme.Add("");
            readme.Add("| Sample | Description | Preview |");
            readme.Add("| --- | --- | --- |");
            foreach (var info in sampleInfos)
            {
                readme.Add(
                    $"| {(string.IsNullOrEmpty(info.LiveUrl) ? info.DisplayNameOrName : $"[{info.DisplayNameOrName}]({info.LiveUrl})")} " +
                    $"| {info.Description} " +
                    $"| {(info.Thumbnail ? $"<img src=\"{Texture2DConverter.GetPathForTexture(info.Thumbnail)}\" height=\"200\"/>" : "")}");
            }
            readme.Add("");
            File.WriteAllLines(readmePath, readme);
            
            // bump dependency to Needle Engine with the one currently set
            var packageJsonPath = "Packages/" + Constants.SamplesPackageName + "/package.json";
            var packageJson = File.ReadAllText(packageJsonPath);
            var allPackages = Client.Search(Constants.ExporterPackageName, true);
            while (!allPackages.IsCompleted)
                await Task.Yield();
            var result = allPackages.Result.FirstOrDefault();
            if (result != null)
            {
                var pattern = $"(\"{Constants.ExporterPackageName}\") *: *\"(.*)\"";
                packageJson = Regex.Replace(packageJson, pattern, $"$1: \"{result.version}\"");
                File.WriteAllText(packageJsonPath, packageJson);
            }
        }

        private static async void ExportLocalPackage()
        {
            var packageFolder = Path.GetFullPath("Packages/" + Constants.SamplesPackageName);
            var targetFolder = Path.GetFullPath("../../");
            Debug.Log("Packing " + packageFolder + " → " + targetFolder);
            var packRequest = Client.Pack(packageFolder, targetFolder);
            while (!packRequest.IsCompleted)
                await Task.Yield();
            if (packRequest.Status == StatusCode.Success)
            {
                var tarball = packRequest.Result.tarballPath;
                var target = Path.GetDirectoryName(tarball) + "/needle-engine-samples.tgz";
                if(File.Exists(target)) File.Delete(target);
                File.Move(tarball, target);
                Debug.Log("Success → " + target);
                EditorUtility.RevealInFinder(target);
            }
        }
    }
}
