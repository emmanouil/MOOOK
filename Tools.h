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


#ifndef __TOOLS_H__
#define __TOOLS_H__

//Query service for modification of coordinates
//Not implemented yet
#define USE_SERVICE			1

//when simulating processing (in ms)
#define MIN_PROC_DELAY			0
#define MAX_PROC_DELAY			3000


#ifdef _DEBUG
void RedirectIOToConsole();
#endif

typedef unsigned __int64 u64;

void init_playlist();

// returns new segment number
u64 write_playlist_segment(u64 seg_num, u64 timeref);

u64 write_playlist_skeleton(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref);

u64 push_skeleton_coordinates(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref, u64 seg_num);

bool flush_skeleton_coordinates(u64 seg_num);

#endif

 