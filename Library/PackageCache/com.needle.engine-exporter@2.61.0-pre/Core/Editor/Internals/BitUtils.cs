namespace Needle.Engine
{
	public static class BitUtils
	{
		public static bool GetBit(this int b, int bitNumber)
		{
			return (b & (1 << bitNumber)) != 0;
		}

		public static int SetBit(this int b, int bitNumber, bool value)
		{
			if (value)
				return b | (1 << bitNumber);
			return b & ~(1 << bitNumber);
		}
	}
}