using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Video;

public enum ScreenCaptureDevice {
	Screen = 0,
	Camera = 1,
	WebglCanvas = 2
}

public class ScreenCapture : MonoBehaviour
{
	public VideoPlayer videoPlayer;
	public ScreenCaptureDevice device = ScreenCaptureDevice.Screen;
}
