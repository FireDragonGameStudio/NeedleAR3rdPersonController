using System;
using System.Reflection;
using Needle.Engine.Utils;
using UnityEngine.Timeline;
using Component = UnityEngine.Component;
using Object = UnityEngine.Object;

namespace Needle.Engine.Timeline
{
	// public class SignalAssetHandler : ITypeMemberHandler
	// {
	// 	public bool ShouldIgnore(Type currentType, MemberInfo member)
	// 	{
	// 		return false;
	// 	}
	//
	// 	public bool ShouldRename(MemberInfo member, out string newName)
	// 	{
	// 		newName = null;
	// 		return false;
	// 	}
	//
	// 	public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
	// 	{
	// 		if (value is SignalAsset signal)
	// 		{
	// 			value = new SignalAssetModel(signal);
	// 			return true;
	// 		}
	// 		return false;
	// 	}
	// }

	[Serializable]
	public class SignalAssetModel
	{
		public string guid;

		public SignalAssetModel(SignalAsset asset)
		{
			this.guid = asset.GetId();
		}
	}
}