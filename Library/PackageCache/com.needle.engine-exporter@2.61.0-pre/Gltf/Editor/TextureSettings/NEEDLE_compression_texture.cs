namespace Needle.Engine.Gltf
{
	public class NEEDLE_compression_texture
	{
		public readonly string mode;
		public readonly string slot;
		public float quality;
		public int maxSize;

		public NEEDLE_compression_texture(string mode, string slot, float quality = -1)
		{
			this.mode = mode;
			this.slot = slot;
			this.quality = quality;
		}
	}
}