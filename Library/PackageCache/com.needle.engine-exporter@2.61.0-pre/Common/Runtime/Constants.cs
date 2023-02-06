namespace Needle.Engine
{
	public static class Constants
	{
		// Keep in sync with BuildTargetConstants
		
#if UNITY_2021_1_OR_NEWER
		public const string PlatformName = "EmbeddedLinux";
#else
		public const string PlatformName = "Lumin";
#endif
		
		public const string MenuItemRoot = "Needle Engine";
		public const int MenuItemOrder = 150;

		public const string PackageDisplayName = "Needle Engine";
		/// <summary>
		/// Unity Package
		/// </summary>
		public const string UnityPackageName = "com.needle.engine-exporter";
		/// <summary>
		/// Unity package
		/// </summary>
		public const string RuntimeUnityPackageName = "com.needle.engine";
		/// <summary>
		/// Js Engine Package
		/// </summary>
		public const string RuntimeNpmPackageName = "@needle-tools/engine";
		
		public const string DocumentationUrl = "https://fwd.needle.tools/needle-engine/help";
		public const string DocumentationUrlScripting = "https://fwd.needle.tools/needle-engine/scripting";
		public const string DocumentationUrlNodejs = "https://docs.needle.tools/nodejs";

		public const string DocumentationComponentGenerator =
			DocumentationUrlScripting + "#automatically-generating-unity-components-from-typescript-files";
		
		
		public const string FeedbackFormUrl = "https://fwd.needle.tools/needle-engine/feedback";
		public const string IssuesUrl = "https://fwd.needle.tools/needle-engine/issues";
		public const string SamplesUrl = "https://engine.needle.tools/samples";

		public const char ExternalLinkChar = '↗';

		public const string ExporterPackagePath = "Packages/" + UnityPackageName;
		public const string RuntimeUnityPackagePath = "Packages/" + RuntimeUnityPackageName;
		public const string RuntimeNpmPackagePath = "Packages/" + RuntimeUnityPackageName + "/package~";
	}
}