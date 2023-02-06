namespace Needle.Engine.Gltf
{
	public static class GltfJsonPointer
	{
		/// <summary>
		/// Path to gltf node
		/// </summary>
		public static string AsNodeJsonPointer(this int nodeId) => "/nodes/" + nodeId;
		
		/// <summary>
		/// Path to mesh
		/// </summary>
		public static string AsMeshPointer(this int index) => "/meshes/" + index;
		
		/// <summary>
		/// Path to material
		/// </summary>
		public static string AsMaterialPointer(this int index) => "/materials/" + index;
		
		/// <summary>
		/// Path to texture
		/// </summary>
		public static string AsTexturePointer(this int index) => "/textures/" + index;
		
		/// <summary>
		/// Path to animation
		/// </summary>
		public static string AsAnimationPointer(this int index) => "/animations/" + index;
		
		/// <summary>
		/// Path to entry in root extension
		/// </summary>
		public static string AsExtensionPointer(this string ext, int index = -1)
		{
			var path = "/extensions/" + ext;
			if (index >= 0) path += "/" + index;
			return path;
		}
	}
}