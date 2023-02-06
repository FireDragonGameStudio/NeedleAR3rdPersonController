namespace Needle.Engine
{
	public interface ICommand
	{
		void Perform();
		void Undo();
	}
}