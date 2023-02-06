using System;

namespace Needle.Engine.Utils
{
	public static class TimeHelper
	{
		public static TimeSpan CalculateTimeRemaining(DateTime processStarted, float total, float current)
		{
			var itemsPerSecond = current / (float)(processStarted - DateTime.Now).TotalSeconds;
			var secondsRemaining = (total - current) / itemsPerSecond;
			return TimeSpan.FromSeconds(secondsRemaining);
		}

	}
}