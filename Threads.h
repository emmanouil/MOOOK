#pragma once

#ifndef _THREADS_H_
	#define _THREADS_H_

	#define EMULATE_INTTYPES
	#define EMULATE_FAST_INT
	#ifndef inline
	#define inline __inline
	#endif


#endif


typedef struct{
//	HANDLE threadHandlers[MAX_THREADS];
//	DWORD threadIDs[MAX_THREADS];
	void* mutex;	//HANDLE
	long threadcount;
}Threader;