#if HAS_NEWINPUTSYSTEM
using System.Reflection;
using Needle.Engine.Gltf;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Needle.Engine.NewInputSystem
{
	public class InputActionsResolver : GltfExtensionHandlerBase, IValueResolver
	{
		public override void OnBeforeExport(GltfExportContext context)
		{
			base.OnBeforeExport(context);
			context.RegisterValueResolver(this);
		}

		public bool TryGetValue(IExportContext ctx, object instance, MemberInfo member, ref object value)
		{

			if (instance is InputControl)
			{
				switch (member.Name)
				{
					case "parent":
					case "device":
						// ignore recursive references
						value = null;
						return true;
				}
			}
			
			if (value is InputActionAsset)
			{
				
			}
			else if (instance is InputAction)
			{
				switch (member.Name)
				{
					case "actionMap":
						// ignore recursive references
						value = null;
						return true;
				}
			}
			
			return false; 
		}
	}
}
#endif