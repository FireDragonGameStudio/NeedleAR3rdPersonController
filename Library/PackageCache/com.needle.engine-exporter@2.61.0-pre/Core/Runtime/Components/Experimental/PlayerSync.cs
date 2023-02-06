using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Components
{
	[HelpURL(Constants.DocumentationUrl)]
	public class PlayerSync : MonoBehaviour
	{
		[Info("Asset to be automatically instantiated and synced per player")]
		public Transform @asset;

#if UNITY_EDITOR
		private void OnValidate()
		{
			if (asset)
			{
				if (!EditorUtility.IsPersistent(asset))
					Debug.LogWarning("Please assign a prefab", this);
				else if (!asset.gameObject.TryGetComponent(out PlayerState _))
				{
					if (EditorUtility.DisplayDialog("Missing " + nameof(PlayerState),
						    "The prefab " + asset.name + " does not contain a " + nameof(PlayerState) + " component, but this component is required for " +
						    nameof(PlayerSync) + " to work properly. Do you want to add this component now?",
						    "Yes, add " + nameof(PlayerState) + " to " + asset.name, "No, do nothing"))
					{
						AddComponent();
						async void AddComponent()
						{
							await Task.Delay(1);
							Undo.AddComponent<PlayerState>(asset.gameObject);
							Selection.activeObject = asset;
						}
					}
					else
						Debug.LogWarning("Assign prefab must have a " + nameof(PlayerState) + " component: " + this.name, asset);
				}
			}
		}
#endif
	}
}