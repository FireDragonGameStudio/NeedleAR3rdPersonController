using System.Collections.Generic;

namespace Needle.Engine
{
	/// <summary>
	/// Holds info about register_types.js files and is used to generate imports
	/// </summary>
	public struct TypeRegisterFileInfo
	{
		public string RelativePath;
		public string AbsolutePath;
	}
	
	/// <summary>
	/// Used to generate register_types.js files
	/// </summary>
	public sealed class TypeRegisterInfo
	{
		public readonly string RegisterTypesPath;
		public readonly List<ImportInfo> Types;

		public TypeRegisterInfo(string registerTypesPath, List<ImportInfo> types)
		{
			RegisterTypesPath = registerTypesPath;
			Types = types;
		}
	}

	public interface ITypeRegisterProvider
	{
		void RegisterTypes(List<TypeRegisterInfo> infos, IProjectInfo projectInfo);
		void GetTypeRegisterPaths(List<TypeRegisterFileInfo> paths, IProjectInfo projectInfo);
	}
}