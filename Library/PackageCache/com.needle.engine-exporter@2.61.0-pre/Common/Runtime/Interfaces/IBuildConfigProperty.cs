namespace Needle.Engine
{
    public interface IBuildConfigProperty
    {
        string Key { get; }
        object GetValue(IExportContext context);
    }
}