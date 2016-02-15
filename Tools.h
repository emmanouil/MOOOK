#include <windows.h>
#include <iostream>
#include <fstream>
#include <conio.h>
#include <stdio.h>
#include <fcntl.h>
#include <io.h>
#include <sstream>

#ifndef __TOOLS_H__
#define __TOOLS_H__


#ifdef _DEBUG
void RedirectIOToConsole();
#endif

typedef unsigned __int64 u64;

void init_playlist();

// returns new segment number
u64 write_playlist_segment(u64 seg_num, u64 timeref);

#endif

 