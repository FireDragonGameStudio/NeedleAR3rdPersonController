using System.Collections.Generic;
using Needle.Engine.Utils;

namespace Needle.Engine
{
	public static class AdditionalDataProviders
	{
		private static IAdditionalDataProvider[] instances;
		public static IList<IAdditionalDataProvider> Instances
		{
			get
			{
				instances ??= InstanceCreatorUtil.CreateCollectionSortedByPriority<IAdditionalDataProvider>().ToArray();
				return instances;
			}
		}
	}
	
	/// <summary>
	/// Implement to inject additional data in newtonsoft serialization
	/// </summary>
	public interface IAdditionalDataProvider
	{
		void GetAdditionalData(IExportContext context, object instance, List<(object key, object value)> additionalData);
	}
}