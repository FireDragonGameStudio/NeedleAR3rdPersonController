#if UNITY_EDITOR
using System.IO;
using Needle.Engine.Codegen;
using UnityEditor;
using UnityEngine;
using UnityEngine.Experimental.GlobalIllumination;
using UnityEngine.SceneManagement;
using LightType = UnityEngine.LightType;

namespace Needle.Engine.Components
{
	public static class MenuItems
	{
		[MenuItem("GameObject/Needle/Set up Scene", validate = true)]
		internal static bool CanSetupScene()
		{
			return !Object.FindObjectOfType<ExportInfo>();
		}

		[MenuItem("GameObject/Needle/Set up Scene")]
		[MenuItem(Constants.MenuItemRoot + "/Set up Scene", priority = Constants.MenuItemOrder + -500)]
		internal static void SetupScene()
		{
			var export = Object.FindObjectOfType<ExportInfo>();
			if (!export)
			{
				var go = new GameObject("Export");
				Undo.RegisterCreatedObjectUndo(go, "Create export GameObject");
				go.tag = "EditorOnly";
				export = Undo.AddComponent<ExportInfo>(go);
				var sceneName = SceneManager.GetActiveScene().name;
				if (string.IsNullOrEmpty(sceneName)) sceneName = "Untitled";
				export.DirectoryName = "Needle/" + sceneName;
			}
			Selection.activeObject = export.gameObject;

			var componentGen = Object.FindObjectOfType<ComponentGenerator>();
			if (!componentGen) Undo.AddComponent<ComponentGenerator>(export.gameObject);

			var gltf = Object.FindObjectOfType<GltfObject>();
			if (!gltf)
			{
				var go = new GameObject("MyScene");
				Undo.RegisterCreatedObjectUndo(go, "Create GLTF root");
				gltf = Undo.AddComponent<GltfObject>(go);

				var cam = Object.FindObjectOfType<Camera>();
				if (!cam)
				{
					var camGo = new GameObject("Camera");
					camGo.tag = "MainCamera";
					camGo.transform.position = new Vector3(0, 0, -3);
					Undo.RegisterCreatedObjectUndo(camGo, "Create camera GameObject");
					cam = Undo.AddComponent<Camera>(camGo);
					cam.nearClipPlane = 0.01f;
					cam.farClipPlane = 100;
					Undo.SetTransformParent(camGo.transform, go.transform, "Move camera into gltf");
					Undo.AddComponent<OrbitControls>(camGo);
				}
				else if (!cam.gameObject.TryGetComponent<OrbitControls>(out _))
				{
					Undo.AddComponent<OrbitControls>(cam.gameObject);
					if (!cam.GetComponentInParent<GltfObject>())
						Undo.SetTransformParent(cam.gameObject.transform, go.transform, "Move camera into gltf");
				}

				// var gridComp = Object.FindObjectOfType<GridHelper>();
				// if (!gridComp)
				// {
				// 	var gridGo = new GameObject("Grid");
				// 	Undo.RegisterCreatedObjectUndo(gridGo, "Create grid GameObject");
				// 	Undo.AddComponent<GridHelper>(gridGo);
				// 	Undo.SetTransformParent(gridGo.transform, go.transform, "Move camera into gltf");
				// }

				var lights = Object.FindObjectsOfType<Light>();
				foreach (var light in lights)
				{
					if (!light.GetComponentInParent<GltfObject>()) 
						Undo.SetTransformParent(light.gameObject.transform, go.transform, "Move light into gltf");
				}
				
				if (lights.Length <= 0)
				{
					var lightGo = new GameObject("Directional Light");
					Undo.RegisterCreatedObjectUndo(lightGo, "Create light GameObject");
					var light = Undo.AddComponent<Light>(lightGo);
					light.type = LightType.Directional;
					light.shadows = LightShadows.Hard;
					var lt = light.transform;
					lt.parent = gltf.transform;
					var pos = lt.localPosition;
					pos.y = 1;
					lt.localPosition = pos;
					var euler = lt.eulerAngles;
					euler.x = 45;
					euler.y = 45;
					lt.eulerAngles = euler;
				}
			}

			Debug.Log("Setup scene complete");
		}
	}
}
#endif