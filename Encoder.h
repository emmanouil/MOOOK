#pragma once

#ifndef _ENCODER_H_
	#define _ENCODER_H_

	#define EMULATE_INTTYPES
	#define EMULATE_FAST_INT
	#ifndef inline
	#define inline __inline
	#endif


#endif

extern "C" {

#include <libavformat/avformat.h>
#include <libavdevice/avdevice.h>
#include <libswscale/swscale.h>
#include <libavutil/mathematics.h>
#include <libavutil/opt.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>


#include <gpac/isomedia.h>
#include <gpac/internal/media_dev.h>
#include <gpac/network.h>
#include <gpac/constants.h>
#include <gpac/setup.h>
#include <gpac/tools.h>
}

/*
//VIDEOS
#define WIDTH 640
#define HEIGHT 480

//ENCODERs
#define FRAMES_PER_SEGMENT 30
#define FRAME_DUR 1
#define SEG_DUR 30
#define BPS 500000
*/

#define INPUT_IS_RGB 1


typedef struct{
	unsigned char *kinectFrame;	//in RGB
	u64 number;	//provided by sdk
	size_t size;	//w*h*3
	u64 pts;	//now-start
}colourFrame;

typedef struct{
	/*FFMPEG specifics*/
	AVCodecContext *codec_ctx;
	AVCodec *codec;
	AVFrame *avframe;
	AVPacket avpacket_out;
	struct SwsContext *sws_ctx;

	/* picture buffer */
	u8 *yuv_buffer;

	/* GPAC ISO stuff */
	GF_ISOFile *isof;
	GF_ISOSample *sample;
	u32 trackID;

	/* encoding parameters */
	uint8_t *vbuf;
	int vbuf_size;
	int encoded_frame_size;

	/*kinect frames*/
	colourFrame *nextColourFrame;
	//skelFrame *nextSkelFrame;

	u64 sys_start;

	int seg_dur;

	u64 first_dts_in_fragment;

	int gop_size;

	u64 pts_at_segment_start, pts_at_first_segment;
	u64 last_pts, last_dts;
	u64 frame_dur;
	u32 timescale;
	u32 nb_segments;

	Bool fragment_started, segment_started;
	const char *rep_id;

	/* RFC6381 codec name, only valid when VIDEO_MUXER == GPAC_INIT_VIDEO_MUXER_AVC1 */
	char codec6381[GF_MAX_PATH];
}DASHout;


DASHout *encoder_init(u32 seg_dur_in_ms, u32 frame_per_segment, u32 frame_dur, u32 timescale, u32 gop_size, u32 width, u32 height, u32 bitrate);

int encoder_encode(DASHout *dasher, u8 *frame, u32 frame_size, u64 PTS);

colourFrame *init_cFrame(size_t size);

void destroy_cFrame(colourFrame *cFrame);