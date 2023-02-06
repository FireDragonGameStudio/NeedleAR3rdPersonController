namespace Needle.Engine
{
	public interface IAssetDependencyInfo
	{
		bool HasChanged { get; }
		void WriteToCache();
	}
}