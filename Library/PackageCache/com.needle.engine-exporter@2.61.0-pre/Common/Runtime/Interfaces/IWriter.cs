namespace Needle.Engine
{
	public interface IWriter
	{
		void Write(string str);
		string Flush();
	}

	public interface ICodeWriter : IWriter
	{
		int Indentation { get; set; }
	}
}