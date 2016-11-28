#include <windows.h>
#include <iostream>
#include <fstream>
#include <conio.h>
#include <stdio.h>
#include <fcntl.h>
#include <io.h>
#include <sstream>
#include "NuiApi.h"

#ifndef __TOOLS_H__
#define __TOOLS_H__

//Query service for modification of coordinates
//Not implemented yet
#define USE_SERVICE			1
//Write coordinates to files (else write in playlist)
#define COORDS_TO_FILES		1
//One Coordinate set per file (otherwise incremental)
#define ONE_SKEL_PER_FILE	1



#ifdef _DEBUG
void RedirectIOToConsole();
#endif

typedef unsigned __int64 u64;

void init_playlist();

// returns new segment number
u64 write_playlist_segment(u64 seg_num, u64 timeref);

u64 write_playlist_skeleton(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref);

#endif

 