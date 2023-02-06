using System;
using UnityEngine;

namespace Needle.Engine.Utils
{
	public class ColorScope : IDisposable
	{
		private readonly Color prev;

		public ColorScope(Color col)
		{
			prev = GUI.color;
			GUI.color = col;
		}

		public void Dispose()
		{
			GUI.color = prev;
		}
	}

}