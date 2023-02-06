using System.Collections.Generic;
using Needle.Engine.Core;
using Needle.Engine.Utils;

namespace Needle.Engine.Interfaces
{
	internal static class AdditionalEmittersCodegen
	{
		private static IAdditionalEmitterCodegen[] instances;
		public static IList<IAdditionalEmitterCodegen> Instances
		{
			get
			{
				instances ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IAdditionalEmitterCodegen>().ToArray();
				return instances;
			}
		}
	}
	
	/// <summary>
	/// Use to emit additional data to code gen for an object
	/// </summary>
	public interface IAdditionalEmitterCodegen
	{
		void EmitAdditionalData(ExportContext context, object target, string currentPath = null);
	}
}