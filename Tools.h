#pragma once

#include <windows.h>
#include <iostream>
#include <fstream>
#include <conio.h>
#include <stdio.h>
#include <fcntl.h>
#include <io.h>
#include <sstream>
#include "NuiApi.h"
#include <random>
#include "Threads.h"
#include "Encoder.h"

#ifndef __TOOLS_H__
#define __TOOLS_H__

#define PAUSE_ON_ERROR	1	//when printErr is used

//Query service for modification of coordinates
//Not implemented yet
#define USE_SERVICE			1

//Maximum number of threads
// we set to 100 since ~30Hz data rate and MAX_PROC_DELAY = 3000ms
#define MAX_THREADS		100

//when simulating processing (in ms)
	//simulation delay parameters
#define MIN_PROC_DELAY			191
#define MAX_PROC_DELAY			3245

	//distribution type
#define UNIFORM_DISTRIBUTION	1
//#define BINOMIAL_DISTRIBUTION	1
//#define NORMAL_DISTRIBUTION	1

	//distribution parameters
#define BINOMIAL_PROPABILITY	0.9
#define NORMAL_STANDARD_DEVIATION	500


#ifdef _DEBUG
void RedirectIOToConsole();
#endif

typedef unsigned __int64 u64;

typedef struct{
	NUI_SKELETON_FRAME skel;
	int index;
	u64 skel_num;
	u64 seg_num;
	long long timeref;
	DASHout* dasher;
	Threader* threader;
}skeletalData;

void init_playlist();

Threader *init_threader();

void write_playlist_segment(u64 seg_num, u64 timeref);

u64 write_playlist_skeleton(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref);

void push_skeleton_coordinates(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref, u64 seg_num);

void generate_projected_coords(skeletalData *in_d);

bool flush_skeleton_coordinates(u64 seg_num);

void printErr(char *msg);

#endif

 