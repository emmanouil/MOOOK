//------------------------------------------------------------------------------
// <copyright file="ColorBasics.cpp" company="Microsoft">
//     Copyright (c) Microsoft Corporation.  All rights reserved.
// </copyright>
//------------------------------------------------------------------------------

#include "Main.h"
#include "Tools.h"
#include "Encoder.h"



//TODO add set/get and destructor
loook_opt* loook_init(void){

	loook_opt *opt;
	GF_SAFEALLOC(opt, loook_opt);

	opt->width = 640;
	opt->height = 480;
	opt->frame_per_segment = 30;
	opt->frame_duration = 1;
	opt->gop_size = 30;
	opt->bitrate = 5000000;
	opt->seg_dur_in_ms = 1000;
//	opt->timescale = 1000000;
	opt->data_size = opt->width * opt->height * 3;

	opt->now = 0;
	opt->timeref = 0;
	opt->timeScreenshot = 0;

	init_playlist();

	return opt;
}

#ifdef USE_GPAC_LOG
static void on_gpac_log(void *cbk, GF_LOG_Level ll, GF_LOG_Tool lm, const char *fmt, va_list list)
{
	vfprintf(stderr, fmt, list);
}
#endif

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
	loook_opt *options;
	
#ifdef _DEBUG
	RedirectIOToConsole();
#endif
	
	options = loook_init();
	
	gf_sys_init(GF_MemTrackerNone);
#ifdef USE_GPAC_LOG
	gf_log_set_tool_level(GF_LOG_DASH, GF_LOG_DEBUG);
	if (gf_log_tool_level_on(GF_LOG_DASH, GF_LOG_DEBUG)) {
		printf("log on");
	} else {
		printf("log off");
	}
	gf_log_set_callback(NULL, on_gpac_log);
#endif
	dasher = muxer_init(options);
	dasher->threader = init_threader();
	if(!dasher){
		return 1;
	}
	if(!dasher->threader){
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