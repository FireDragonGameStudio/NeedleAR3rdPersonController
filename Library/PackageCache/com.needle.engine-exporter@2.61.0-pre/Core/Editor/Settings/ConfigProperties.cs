using JetBrains.Annotations;
using Needle.Engine.Settings;

namespace Needle.Engine.Core
{
	[UsedImplicitly]
	internal class UseGizp : IBuildConfigProperty
	{
		public string Key => "gzip";
		public object GetValue(IExportContext context)
		{
			return NeedleEngineBuildOptions.UseGzipCompression;
		}
	}


	[UsedImplicitly]
	internal class UseHotReload : IBuildConfigProperty
	{
		public string Key => "allowHotReload";
		public object GetValue(IExportContext context)
		{
			return ExporterProjectSettings.instance.useHotReload;
		}
	}
}