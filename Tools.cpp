#include "Tools.h"

#ifndef _USE_OLD_IOSTREAMS
using namespace std;
#endif

// maximum mumber of lines the output console should have
static const WORD MAX_CONSOLE_LINES = 500;
//std::string ipAddr = "137.194.23.204";
std::string ipAddr = "localhost";

std::ostringstream vidListStream;
std::ostringstream playlistStream;
std::ostringstream finalStream;
std::string tmp;

std::ofstream vidPlaylist;
std::ofstream playlistFile;


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
}

u64 write_playlist_segment(u64 seg_num, u64 timeref){
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
	playlistFile.open("x64/Debug/out/playlist.m3u8");
	if (playlistFile.is_open()){
		playlistFile << playlistStream.str();
	}
			
	playlistFile.close();

	seg_num++;
	return seg_num;

}