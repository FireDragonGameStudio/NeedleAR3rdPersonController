using UnityEditor;

// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
	public class NeedleEngineBuildOptions
	{
		public static bool DevelopmentBuild
		{
#if UNITY_EDITOR
			get => EditorPrefs.GetBool("Needle.Engine.DevelopmentBuild", false);
			set => EditorPrefs.SetBool("Needle.Engine.DevelopmentBuild", value);
#else
			get => false;
			set { }
#endif
		}


		public static bool UseGzipCompression
		{
#if UNITY_EDITOR
			get => EditorPrefs.GetBool("Needle.Engine.UseGzipCompression", false);
			set => EditorPrefs.SetBool("Needle.Engine.UseGzipCompression", value);
#else
			get => false;
			set { }
#endif
		}
	}
}