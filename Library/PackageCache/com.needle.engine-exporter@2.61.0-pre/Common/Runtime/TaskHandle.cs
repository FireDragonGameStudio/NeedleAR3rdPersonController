using System.Threading;
using System.Threading.Tasks;

namespace Needle.Engine
{
	public interface ITaskHandle
	{
		Task Task { get; }
		bool Cancel();
	}
	
	public readonly struct TaskHandle : ITaskHandle
	{
		private readonly CancellationTokenSource cancellationTokenSource;

		public TaskHandle(Task task, CancellationTokenSource cancellationTokenSource = default)
		{
			this.cancellationTokenSource = cancellationTokenSource;
			Task = task;
		}

		public Task Task { get; }
		
		public bool Cancel()
		{
			cancellationTokenSource?.Cancel();
			return Task.IsCanceled;
		}
	}
}