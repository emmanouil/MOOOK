//------------------------------------------------------------------------------
// <copyright file="ColorBasics.cpp" company="Microsoft">
//     Copyright (c) Microsoft Corporation.  All rights reserved.
// </copyright>
//------------------------------------------------------------------------------

#include "Main.h"
#include "Tools.h"
#include "Encoder.h"

/// <summary>
/// Entry point for the application
/// </summary>
/// <param name="hInstance">handle to the application instance</param>
/// <param name="hPrevInstance">always 0</param>
/// <param name="lpCmdLine">command line arguments</param>
/// <param name="nCmdShow">whether to display minimized, maximized, or normally</param>
/// <returns>status</returns>
int APIENTRY wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpCmdLine, int nCmdShow)
{
    CColorBasics application;

	//params:
	DASHout *dasher;
	u32 width = 640;
	u32 height = 480;
	u32 frame_per_segment = 30;
	u32 frame_duration = 1;
	int segment_duration = 30;
	u32 gop_size = 30;
	u32 bitrate = 500000;
	u32 seg_dur_in_ms = 1000;
	u32 timescale = 1000000;
	int seg_num = 1;
	u32 data_size = width * height * 3;

	u64 now = 0;
	u64 timeref = 0;
	u64 timeScreenshot = 0;
	
#ifdef _DEBUG
	RedirectIOToConsole();
#endif
	
	gf_sys_init(GF_FALSE);

	dasher = encoder_init(seg_dur_in_ms, frame_per_segment, frame_duration, timescale, gop_size, width, height, bitrate);

	if(!dasher){
		return 1;
	}	

	application.setDasher(dasher);

    application.Run(hInstance, nCmdShow, dasher);
	/*
KinectSensor sensor;

  foreach (var potentialSensor in KinectSensor.KinectSensors)
  {
    if (potentialSensor.Status == KinectStatus.Connected)
    {
      this.sensor = potentialSensor;
      break;
    }
  }*/
}