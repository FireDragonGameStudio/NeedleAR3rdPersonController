namespace Needle.Engine
{
	public interface IBuildContext
	{
		bool IsDistributionBuild { get; }
		bool ViaContextMenu { get; }
	}

	public interface IHasBuildContext
	{
		IBuildContext BuildContext { get; } 
	}
}