#nullable enable
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Needle.Engine.Core
{
	public static class BuildTaskList
	{
		public static Task WaitForPostExportTasksToComplete() => Task.WhenAll(_postExportTasks.Select(t => t.Task));
		
		private static readonly List<TaskHandle> _postExportTasks = new List<TaskHandle>();

		/// <summary>
		/// Add tasks to the post export list to ensure they are finished after the Export is done. This is useful to kickoff external processes and await them before e.g. deploying the build
		/// </summary>
		public static void SchedulePostExport(Task task, CancellationTokenSource? cancel = null)
		{
			_postExportTasks.Add(new TaskHandle(task, cancel));
		}

		public static void ResetAllAndCancelRunning()
		{
			foreach (var t in _postExportTasks) t.Cancel();
			_postExportTasks.Clear();
		}
	}
}