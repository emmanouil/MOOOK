#include "Encoder.h"


#ifdef _DEBUG
void av_log_callback(void *ptr, int level, const char *fmt, va_list vargs)
{
	printf("\n[FFMPEG LOG]  ");
    vprintf(fmt, vargs);
	printf("\n");
}


#endif



colourFrame *init_cFrame(size_t size){
	colourFrame *cFrame;
	GF_SAFEALLOC(cFrame, colourFrame);
	cFrame->size = size;
	cFrame->kinectFrame = (unsigned char*) gf_malloc(size);
	return cFrame;
}

DASHout *encoder_init(u32 seg_dur_in_ms, u32 frame_per_segment, u32 frame_dur, u32 timescale, u32 gop_size, u32 width, u32 height, u32 bitrate){
	

#ifdef _DEBUG
	av_log_set_callback(av_log_callback);
	av_log_set_level(AV_LOG_VERBOSE);
#endif

	DASHout *dasher;
	GF_SAFEALLOC(dasher, DASHout);

	dasher->sample = gf_isom_sample_new();
	dasher->isof = NULL;

	dasher->seg_dur = seg_dur_in_ms;
	dasher->gop_size = gop_size;
	dasher->frame_dur = frame_dur;

	dasher->avpacket_out.size = 0;

	dasher->avframe = av_frame_alloc();
	av_init_packet(&dasher->avpacket_out);

	//alloc a FFMPEG buffer to store encoded data
	dasher->vbuf_size = 9 * width * height + 10000;
	dasher->vbuf = (uint8_t *)av_malloc(dasher->vbuf_size);

	av_register_all();
	avcodec_register_all();

	dasher->codec = avcodec_find_encoder_by_name("libx264");
	if (dasher->codec == NULL) {
		printf("Output video codec libx264 not found\n");
		av_free(dasher->vbuf);
		av_free(dasher->avframe);
		gf_isom_sample_del(&dasher->sample);
		gf_free(dasher);
		return NULL;
	}else{
			printf("Output video codec libx264 OK\n parsing parameters to AVContentContext... ");
	}

	dasher->codec_ctx = avcodec_alloc_context3(dasher->codec);
	
	dasher->codec_ctx->pix_fmt = AV_PIX_FMT_YUV420P;
	//dasher->codec_ctx->pix_fmt = AV_PIX_FMT_RGB24;
	dasher->codec_ctx->width = width;
	dasher->codec_ctx->height = height;

	//dasher->codec->pix_fmts = &dasher->codec_ctx->pix_fmt;

	dasher->codec_ctx->codec_id = dasher->codec->id;
	dasher->codec_ctx->codec_type = AVMEDIA_TYPE_VIDEO;
	dasher->codec_ctx->bit_rate = bitrate;
	dasher->codec_ctx->sample_aspect_ratio.num = dasher->codec_ctx->sample_aspect_ratio.den = 1;
	dasher->codec_ctx->time_base.num = 1;
	dasher->codec_ctx->time_base.den = (seg_dur_in_ms/1000)*frame_per_segment;

	//dasher->codec_ctx->pix_fmt = AV_PIX_FMT_RGB24;
	dasher->codec_ctx->gop_size = 30;

	//TODO: check these values
	av_opt_set(dasher->codec_ctx->priv_data, "vprofile", "baseline", 0);
	av_opt_set(dasher->codec_ctx->priv_data, "preset", "ultrafast", 0);
	av_opt_set(dasher->codec_ctx->priv_data, "tune", "zerolatency", 0);
	av_opt_set(dasher->codec_ctx->priv_data, "x264opts", "no-mbtree:sliced-threads:sync-lookahead=0", 0);

	//the global header gives access to the extradata (SPS/PPS) in ffmpeg extra data
	dasher->codec_ctx->flags |= CODEC_FLAG_GLOBAL_HEADER;

	/* open the video codec - options are passed thru dasher->codec_ctx->priv_data */
	int pop = avcodec_open2(dasher->codec_ctx, dasher->codec, NULL) ;
	if (pop < 0) {
		av_free(dasher->codec_ctx);
		av_free(dasher->vbuf);
		av_free(dasher->avframe);
		gf_isom_sample_del(&dasher->sample);
		gf_free(dasher);
		printf("ERROR Cannot open output video codec \n");
		return NULL;
	}else{
		printf("OK \n");
	}

	if (INPUT_IS_RGB) {
		/*dasher->rgb_yuv_ctx = sws_getContext(width, height, AV_PIX_FMT_RGB24,
			width, height, AV_PIX_FMT_YUV420P,
			0, 0, 0, 0);*/
		dasher->sws_ctx = sws_getContext(width, height, AV_PIX_FMT_RGB24, width, height, AV_PIX_FMT_YUV420P, 0, 0, 0, 0);
		dasher->yuv_buffer = (u8 *)av_malloc(width*height * 3 / 2);


		if(!dasher->sws_ctx){
			printf("ERROR Cannot create sws context for RGB to YUV conversion \n");
			return NULL;
		}	
	}


	
	dasher->sys_start = gf_sys_clock_high_res();
	return dasher;
}

int encoder_encode(DASHout *dasher, u8 *frame, u32 frame_size, u64 PTS){
	AVPacket pkt;
	int got_packet;

	av_init_packet(&pkt);
	pkt.data = dasher->vbuf;
	pkt.size = dasher->vbuf_size;

	pkt.pts = pkt.dts = dasher->avframe->pts = dasher->avframe->pkt_dts = dasher->avframe->pkt_pts = PTS;


	// AVFrame : decoded/raw video data
	dasher->avframe->width = dasher->codec_ctx->width;
	dasher->avframe->height = dasher->codec_ctx->height;

	if (dasher->sws_ctx) {
		uint8_t * inData[1] = { frame }; // RGB24 have one plane
		int inLinesize[1] = { 3 * dasher->codec_ctx->width }; // RGB stride

		uint8_t * outData[3];
		int outLinesize[3];

		outLinesize[0] = dasher->codec_ctx->width;
		outLinesize[1] = dasher->codec_ctx->width / 2;
		outLinesize[2] = dasher->codec_ctx->width / 2;
		outData[0] = dasher->yuv_buffer;
		outData[1] = dasher->yuv_buffer + dasher->codec_ctx->width*dasher->codec_ctx->height;
		outData[2] = dasher->yuv_buffer + 5 * dasher->codec_ctx->width*dasher->codec_ctx->height / 4;

		int hei = sws_scale(dasher->sws_ctx, inData, inLinesize, 0, dasher->codec_ctx->height, outData, outLinesize);
		frame = dasher->yuv_buffer;
	}

	// Size in bytes for each picture line
	dasher->avframe->linesize[0] = dasher->codec_ctx->width;
	dasher->avframe->linesize[1] = dasher->codec_ctx->width / 2;
	dasher->avframe->linesize[2] = dasher->codec_ctx->width / 2;

	// frame intervient ici
	dasher->avframe->format = AV_PIX_FMT_YUV420P;
	dasher->avframe->data[0] = frame;
	dasher->avframe->data[1] = frame + dasher->codec_ctx->width * dasher->codec_ctx->height;
	dasher->avframe->data[2] = frame + 5 * dasher->codec_ctx->width * dasher->codec_ctx->height / 4;


	dasher->avframe->pict_type = AV_PICTURE_TYPE_NONE;

	//if segment is not started, force a new frame
	if (!dasher->segment_started)
		dasher->avframe->pict_type = AV_PICTURE_TYPE_I; // frame intra

	// encodage? Takes raw video data from frame and writes the next output packet
	// Param 1 : codec context
	// Param 2 : output AVPacket
	// Param 3 : [in] AVFrame containing raw video data to be encoded
	// Param 4 : [out] 1 if output packet non-empty and 0 if empty

	//Return 0 on success, negative error code on failure
	dasher->encoded_frame_size = avcodec_encode_video2(dasher->codec_ctx, &dasher->avpacket_out, dasher->avframe, &got_packet);


	if (dasher->encoded_frame_size >= 0)
		dasher->encoded_frame_size = pkt.size;

	if (dasher->encoded_frame_size >= 0) {
		if (got_packet) {
//			dasher->codec_ctx->coded_frame->pts = dasher->codec_ctx->coded_frame->pkt_pts = pkt.pts;
//			dasher->codec_ctx->coded_frame->pkt_dts = pkt.dts;
//			dasher->codec_ctx->coded_frame->key_frame = (pkt.flags & AV_PKT_FLAG_KEY) ? 1 : 0;
		}
	}
	if (dasher->encoded_frame_size < 0) {
		GF_LOG(GF_LOG_ERROR, GF_LOG_DASH, ("Error occured while encoding video frame.\n"));
		return -1;
	}

	return dasher->encoded_frame_size;



	return -1;
}

void destroy_encoder(DASHout *dasher){
	sws_freeContext(dasher->sws_ctx);
	av_free(dasher->codec_ctx);
	av_free(dasher->vbuf);
	av_free(dasher->avframe);
	gf_isom_sample_del(&dasher->sample);
	gf_free(dasher);
}

void destroy_cFrame(colourFrame *cFrame){
	gf_free(cFrame);
}