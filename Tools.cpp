#include "Tools.h"

#ifndef _USE_OLD_IOSTREAMS
using namespace std;
#endif


// maximum mumber of lines the output console should have
static const WORD MAX_CONSOLE_LINES = 500;
//std::string ipAddr = "137.194.23.204";
std::string ipAddr = "localhost";

std::ostringstream vidListStream;
std::ostringstream playlistStream;		//playlist output
std::ostringstream coordinateStream;	//coordinates to be written to file

std::ostringstream finalStream;
std::string tmp;

std::ofstream vidPlaylist;
std::ofstream playlistFile;
std::ofstream coordinateFile;

std::stringstream projected_skels;
std::stringstream proccessed_skels;

std::stringstream errlog;


#ifdef _DEBUG

void RedirectIOToConsole(){

	int hConHandle;
	long lStdHandle;
	CONSOLE_SCREEN_BUFFER_INFO coninfo;
	FILE *fp;

	// allocate a console for this app
	AllocConsole();

	// set the screen buffer to be big enough to let us scroll text
	GetConsoleScreenBufferInfo(GetStdHandle(STD_OUTPUT_HANDLE),	&coninfo);
	coninfo.dwSize.Y = MAX_CONSOLE_LINES;
	SetConsoleScreenBufferSize(GetStdHandle(STD_OUTPUT_HANDLE),	coninfo.dwSize);

	// redirect unbuffered STDOUT to the console
	lStdHandle = (long)GetStdHandle(STD_OUTPUT_HANDLE);
	hConHandle = _open_osfhandle(lStdHandle, _O_TEXT);
	fp = _fdopen( hConHandle, "w" );
	*stdout = *fp;
	setvbuf( stdout, NULL, _IONBF, 0 );

	// redirect unbuffered STDIN to the console
	lStdHandle = (long)GetStdHandle(STD_INPUT_HANDLE);
	hConHandle = _open_osfhandle(lStdHandle, _O_TEXT);
	fp = _fdopen( hConHandle, "r" );
	*stdin = *fp;
	setvbuf( stdin, NULL, _IONBF, 0 );

	// redirect unbuffered STDERR to the console
	lStdHandle = (long)GetStdHandle(STD_ERROR_HANDLE);
	hConHandle = _open_osfhandle(lStdHandle, _O_TEXT);
	fp = _fdopen( hConHandle, "w" );
	*stderr = *fp;
	setvbuf( stderr, NULL, _IONBF, 0 );

	// make cout, wcout, cin, wcin, wcerr, cerr, wclog and clog
	// point to console as well
	ios::sync_with_stdio();

}


#endif


void init_playlist(){
	vidListStream << "],\n\"Video_Segment\": \"seg_init_gpac.mp4\"}\n";
	playlistStream << "http://" << ipAddr << ":8080/x64/Debug/out/seg_init_gpac.mp4\n";
	playlistFile.open("x64/Debug/out/playlist.m3u8");
	if (playlistFile.is_open()){
		playlistFile << playlistStream.str();
	}
	playlistFile.close();
}

Threader* init_threader(void){

	Threader *threader;
	GF_SAFEALLOC(threader, Threader);
	threader->threadcount = 0;

	threader->mutex = CreateMutex(NULL, FALSE, NULL);
	if(threader->mutex == NULL) return NULL;

	return threader;
}


void write_playlist_segment(u64 seg_num, u64 timeref){
	tmp = vidListStream.str();
	vidListStream.seekp(0);
	vidListStream << "\n\t\t{ \n\t\t\"Open_segment_time\":" << "\"" << timeref << "\",";
	vidListStream << "\n\t\t\"Video_Segment\": \"seg_" << seg_num << "_gpac.m4s\",\n\t\t\"Skel_Segments\":";
	//	vidListStream << "[" << skelListStream.str() << "],\n\t\t";
	//	vidListStream << "\"Slides\": [" << imListStream.str() << "]\n";

	if (seg_num == 1){
		vidListStream << "\t\t}\n";
	}
	else{
		vidListStream << "\t\t},\n";
	}

	vidListStream << tmp;

	finalStream << "{\"Playlist\":\n\t[" << vidListStream.str();
	vidPlaylist.open("x64/Debug/out/playlist.json");
	vidPlaylist << finalStream.str();
	vidPlaylist.close();

	finalStream.str("");
	//	imListStream.str("");
	//	skelListStream.str("");

	playlistStream << "http://" << ipAddr << ":8080/x64/Debug/out/seg_" << seg_num << "_gpac.m4s\n";
	playlistFile.open("x64/Debug/out/playlist.m3u8", std::ios_base::app);
	if (playlistFile.is_open()){
		playlistFile << "http://" << ipAddr << ":8080/x64/Debug/out/seg_" << seg_num << "_gpac.m4s\n";
	}
	playlistFile.close();

//	moved to ColorBasics (needed for skels as well)
//	seg_num++;

}

/*
 * Simulate processing
 *
 */
void generate_projected_coords(skeletalData *in_d){
	skeletalData in;
	memcpy(&in, in_d, sizeof(skeletalData));

	Threader *thr = in_d->threader;
	DASHout *das = in_d->dasher;

	std::ostringstream skelListStream, coords, tmp;	//this is used only for the projected join coordinates
	NUI_SKELETON_DATA skeleton = in.skel.SkeletonData[in.index];
	u64 timeref = in.timeref/1000;	//we need it in ms
	//vars for holding the projected joint coordinates of the centre point
	LONG x, y;
	USHORT depth;
	LARGE_INTEGER t1, t2, freq;
	float delay;
	BOOL mut_freed;

	// get ticks per second
	QueryPerformanceFrequency(&freq);

	// start timer
	QueryPerformanceCounter(&t1);

	NuiTransformSkeletonToDepthImage(skeleton.Position, &x, &y, &depth);
	coords << " SEG:" << in_d->seg_num << " SKN:" << in_d->skel_num << " FRN:" << in.skel.dwFrameNumber << " A:" << x << ","<< y << ","<< depth;	//position of "center"

	for (int i = 0; i < NUI_SKELETON_POSITION_COUNT; ++i){
		//write the rest of the projected values as well
		coords << " " << i << ":";
		if(skeleton.eSkeletonPositionTrackingState[i] != NUI_SKELETON_POSITION_NOT_TRACKED){
			NuiTransformSkeletonToDepthImage(skeleton.SkeletonPositions[i], &x, &y, &depth);
			coords << x << "," << y << "," << depth;
		}
	}

	coordinateStream << "\n" << "TYPE:PROJ " << "T:" << timeref << coords.str() <<"\n \n";

	//sleep (simulate processing)
#ifdef UNIFORM_DISTRIBUTION
	random_device rd;
	mt19937 gen(rd());
	uniform_int_distribution<> dist(MIN_PROC_DELAY, MAX_PROC_DELAY);
	int millis = dist(gen);
#elif NORMAL_DISTRIBUTION
	//std::default_random_engine generator;
	random_device rd;
	mt19937 gen(rd());
	normal_distribution<float> dist(MAX_PROC_DELAY/2, NORMAL_STANDARD_DEVIATION);
	int millis = static_cast<int>(dist(gen));
#elif BINOMIAL_DISTRIBUTION
	std::default_random_engine generator;
	binomial_distribution<int> dist(MAX_PROC_DELAY-MIN_PROC_DELAY, BINOMIAL_PROPABILITY);
	int millis = dist(generator)+MIN_PROC_DELAY;
#endif
	Sleep(millis);
	printf("generated skel %u \n",in.skel_num);	//TODOk remove
	// stop timer
	QueryPerformanceCounter(&t2);
	delay = (t2.QuadPart - t1.QuadPart) * 1000.0 / freq.QuadPart;	//in ms

	//write to stream
	skelListStream << "TYPE:DELA " << "T:" << timeref+delay << coords.str() << " " << "D:" << delay << "\n \n";

	//count
	//((Threader *) in_d->threader)->threadcount--;

	//acquire mutex
	
	DWORD waitResult = WaitForSingleObject(thr->mutex, 10);

	switch(waitResult){
		printf("Thread %d ", GetCurrentThreadId());
		case WAIT_OBJECT_0:
			printf("got the mutex...\n", GetCurrentThreadId());
			proccessed_skels << skelListStream.str();
			mut_freed = ReleaseMutex(thr->mutex);
			if(!mut_freed){
				printErr("ERROR on releasing the mutex...\n");
			}else{
				printf("Thread %d released the mutex...\n", GetCurrentThreadId());
			}
			break;
		case WAIT_ABANDONED:
			printf("Thread %d got ABANDONED mutex... [Line %d File %s] \n", GetCurrentThreadId(), __LINE__, __FILE__);
			getchar();
		default:
			printf("got UNKNOWN mutex status... [Line %d File %s] \n", __LINE__, __FILE__);
			getchar();
	}

	tmp.clear();
	coords.clear();
	skelListStream.clear();
}

/*
 * Used for multiple coords per file
 * Called when new coordinate set arrives
 */
void push_skeleton_coordinates(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref, u64 seg_num){
	
	NUI_SKELETON_DATA skeleton = skel.SkeletonData[index];
	LARGE_INTEGER k_frameTimestamp = skel.liTimeStamp;
	u64 k_frameNo = skel.dwFrameNumber;
	Vector4 k_floor = skel.vFloorClipPlane;
	timeref = timeref/1000;	//we need it in ms
//	std::ostringstream skelListStream;	//this is used only for the projected join coordinates

	coordinateStream << "TYPE:ORIG " << "T:" << timeref << " SEG:" << seg_num << " SKN:" << skel_num << " FRN:" << skel.dwFrameNumber << " A:" << skeleton.Position.x << ","<< skeleton.Position.y << ","<< skeleton.Position.z;	//position of "center"


	for (int i = 0; i < NUI_SKELETON_POSITION_COUNT; ++i){

		//write the joint coordinates
		coordinateStream << " " << i << ":";
		if(skeleton.eSkeletonPositionTrackingState[i] != NUI_SKELETON_POSITION_NOT_TRACKED){
			coordinateStream << skeleton.SkeletonPositions[i].x << "," << skeleton.SkeletonPositions[i].y << "," << skeleton.SkeletonPositions[i].z;
		}

/*
		//write the projected values as well (as a different entry)
		skelListStream << " " << i << ":";
		if(skeleton.eSkeletonPositionTrackingState[i] != NUI_SKELETON_POSITION_NOT_TRACKED){
			NuiTransformSkeletonToDepthImage(skeleton.SkeletonPositions[i], &x, &y, &depth);
			skelListStream << x << "," << y << "," << depth;
		}
*/
	}
	coordinateStream << "\n" ;

	return;
}

bool flush_skeleton_coordinates(u64 seg_num){
	std::ostringstream coordFileName;
	coordFileName << "x64/Debug/out/COORD_" << seg_num << ".txt";
	coordinateFile.open(coordFileName.str());
	if (coordinateFile.is_open()){
		coordinateFile << coordinateStream.str();
		coordinateFile << proccessed_skels.str();
	}

	coordinateFile.close();
	coordinateStream.str("");
	coordinateStream.clear();
	proccessed_skels.str("");
	proccessed_skels.clear();

	playlistFile.open("x64/Debug/out/playlist.m3u8", std::ios_base::app);
	if (playlistFile.is_open()){
		playlistFile << coordFileName.str() << "\n";
	}else{
		return false;
	}
	playlistFile.close();
	return true;
}


u64 write_playlist_skeleton(const NUI_SKELETON_FRAME &skel, int index, u64 skel_num, u64 timeref){

	NUI_SKELETON_DATA skeleton = skel.SkeletonData[index];
	LARGE_INTEGER k_frameTimestamp = skel.liTimeStamp;
	u64 k_frameNo = skel.dwFrameNumber;
	Vector4 k_floor = skel.vFloorClipPlane;
	timeref = timeref/1000;	//we need it in ms
	std::ostringstream skelListStream;	//this is used only for the projected join coordinates
	std::ostringstream coordFileName;

	//vars for holding the projected joint coordinates
	LONG x, y;
	USHORT depth;

	coordinateStream << "T:" << timeref << " A:" << skeleton.Position.x << ","<< skeleton.Position.y << ","<< skeleton.Position.z;	//position of "center"

	NuiTransformSkeletonToDepthImage(skeleton.Position, &x, &y, &depth);
	skelListStream << "T:" << timeref << " A:" << x << ","<< y << ","<< depth;	//position of "center"

	for (int i = 0; i < NUI_SKELETON_POSITION_COUNT; ++i){

		//write the joint coordinates
		coordinateStream << " " << i << ":";
		if(skeleton.eSkeletonPositionTrackingState[i] != NUI_SKELETON_POSITION_NOT_TRACKED){
			coordinateStream << skeleton.SkeletonPositions[i].x << "," << skeleton.SkeletonPositions[i].y << "," << skeleton.SkeletonPositions[i].z;
		}


		//write the projected values as well (as a different entry)
		skelListStream << " " << i << ":";
		if(skeleton.eSkeletonPositionTrackingState[i] != NUI_SKELETON_POSITION_NOT_TRACKED){
			NuiTransformSkeletonToDepthImage(skeleton.SkeletonPositions[i], &x, &y, &depth);
			skelListStream << x << "," << y << "," << depth;
		}
	}

	coordinateStream << "\n" << skelListStream.str() << "\n";

	coordFileName << "x64/Debug/out/COORD_" << k_frameTimestamp.QuadPart << ".txt";
	coordinateFile.open(coordFileName.str());
	if (coordinateFile.is_open()){
		coordinateFile << coordinateStream.str();
	}

	coordinateFile.close();
	skelListStream.str("");
	skelListStream.clear();
	coordinateStream.str("");
	coordinateStream.clear();

	playlistFile.open("x64/Debug/out/playlist.m3u8", std::ios_base::app);
	if (playlistFile.is_open()){
		playlistFile << coordFileName.str() << "\n";
	}
	playlistFile.close();

	skel_num++;
	return skel_num;
}

void printErr(char *msg){
	fprintf(stdout, msg);
	errlog << msg;
#if PAUSE_ON_ERROR
	getchar();
#endif
}