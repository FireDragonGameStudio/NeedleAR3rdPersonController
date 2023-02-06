using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine.Settings
{
	[FilePath("UserSettings/NeedleExporterUserSettings.asset", FilePathAttribute.Location.ProjectFolder)]
	public class ExporterUserSettings : ScriptableSingleton<ExporterUserSettings>
	{
		public void Save() => Save(true);

		[SerializeField] private bool firstInstallation = true;

		public bool FirstInstallation
		{
			get => firstInstallation;
			set
			{
				// can only set to true once
				if (!firstInstallation || value == true) return;
				firstInstallation = false;
				Save();
				Analytics.RegisterInstallation();
			}
		}
	}
}