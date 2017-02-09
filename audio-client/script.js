/*	This file does the initializing, generic playlist parsing and the MSE actions
 *	For coord-parsing and other function are in processor.js
 *
 *	Timeline for script.js:
 *	We first fetch the playlist
 *	Then the MSE is opened
 *	When the sourceopene is fired we feed the first element of the playlist (we assume to be the init .mp4 file)
 *	After that for each playlist element we check if its coords or segment
 *	And appendNextMediaSegment or handleCoordSet is called
 */

//options
const WITH_COORDS_IN_PL = true;	//backwards compatibility - to be removed
var playlist_dir = '../x64/Debug/out/playlist.m3u8';
var seg_url = 'http://localhost:8080/x64/Debug/out/';
var coord_url = 'http://localhost:8080/';
const DISABLE_AUDIO = true;
const withReverb = false;
const withDistortion = false;
const withModulation = true;
const reverbFile = 'concert-crowd2.ogg';

//vars
var mime_codec = 'video/mp4; codecs="avc1.42c01e"';
var mediaSource = new MediaSource();
var video, playlist, textTrack, cues;
var skeleton_worker = new Worker('skel_parser.js');
var req_status = -10;
var segBuffer = 10;

//after window loads do the init
window.onload = function() {
	video = document.getElementById('v');
	mediaSource.video = video;
	video.ms = mediaSource;
	video.src = window.URL.createObjectURL(mediaSource);
	if (withReverb) fetch(reverbFile, initReverb, "arraybuffer");
	fetch_pl();
	initMSE();
}

//MSE-specific functions
function initMSE() {
	if (req_status == 200 && playlist.length > 0) {
		if (mediaSource.readyState = "open") {
			onSourceOpen();
		} else {
			mediaSource.addEventListener("sourceopen", onSourceOpen);
		}
	} else if (req_status == 200) {
		console.log("[ABORTING] fetched playlist is empty");
	} else {
		console.log("waiting for playlist");
		setTimeout(initMSE, 500);
	}
}

function onSourceOpen() {

	if (mediaSource.sourceBuffers.length > 0)
		return;

	sourceBuffer = mediaSource.addSourceBuffer(mime_codec);
	sourceBuffer.ms = mediaSource;

	//we assume the first playlist element is the location of the init segment
	sourceBuffer.addEventListener('updateend', fetch(playlist[0], firstSegment, "arraybuffer"));
}

//Append the initialization segment.
function firstSegment() {

	var initSegment = this.response;

	if (initSegment == null) {
		// Error fetching the initialization segment. Signal end of stream with an error.
		mediaSource.endOfStream("network");
		return;
	}

	sourceBuffer.addEventListener('updateend', handleNextPlElement);
	sourceBuffer.appendBuffer(initSegment);
}

//Handle following pl elements
function handleNextPlElement() {
	//sourceBuffer.removeEventListener('updateend', appendHandler);

	// Append some initial media data.
	//TODO instead of terminating MSE - poll for new segs
	if (playlist[1] == null) {
		//mediaSource.endOfStream();
		return;
	} else {
		element = playlist.splice(1, 1).toString();
		if (element.endsWith('.m4s')) { //we have a segment
			fetch(element, appendNextMediaSegment, "arraybuffer");
			if(video.paused)
				start_video();
		}else if (element.endsWith('.txt')) { //we have a coordinates file
			fetch(coord_url+element, parse_CoordFile);
		}else if(element.startsWith("T:")){ //we have a coordinate set file	DEPRICATED
			handleCoordSet(element);
		}else if(element.length<2){
			console.log("possible blank line in playlist - ignoring");
			handleNextPlElement();
		}else{
			console.log("[WARNING] Unknown element in playlist - ignoring "+element);
		}
	}
}


function appendNextMediaSegment(frag_resp) {
	console.log(frag_resp.target.response.byteLength);
	if (mediaSource.readyState == "closed")
		return;
	/*
	    // If we have run out of stream data, then signal end of stream.
	    if (!HaveMoreMediaSegments()) {
	      mediaSource.endOfStream();
	      return;
	    }
	*/
	// Make sure the previous append is not still pending.
	if (mediaSource.sourceBuffers[0].updating)
		return;

	var mediaSegment = frag_resp.target.response;

	if (!mediaSegment) {
		// Error fetching the next media segment.
		//mediaSource.endOfStream("network");
		return;
	}

	// NOTE: If mediaSource.readyState == “ended”, this appendBuffer() call will
	// cause mediaSource.readyState to transition to "open". The web application
	// should be prepared to handle multiple “sourceopen” events.
	mediaSource.sourceBuffers[0].appendBuffer(mediaSegment);
}

//Content-loading functions
function fetch(what, where, resp_type) {
	console.log("fetching " + what);
	if (what.length < 2) {
		console.log("erroneous request");
	}
	var req = new XMLHttpRequest();
	req.addEventListener("load", where);
	req.open("GET", what);
	if (typeof(resp_type) != 'undefined') {
		req.responseType = resp_type;
	}
	req.send();
}

function fetch_pl() {
	fetch(playlist_dir, parse_playlist);
}

function parse_playlist() {
	playlist = this.responseText.split(/\r\n|\r|\n/); //split on break-line
	req_status = this.status;
}

function parse_CoordFile(coordCtx){
	coords_in = this.responseText.split(/\r\n|\r|\n/); //split on break-line
	req_status = this.status;
	handleCoordFile(coords_in);
	handleNextPlElement();
}

function handleCoordFile(coors) {
	skeleton_worker.postMessage({
			type: 'coord_f',
			data: coors
		})
		//parse_skeleton(coors);
	handleNextPlElement();
}

function handleCoordSet(coors) {
	skeleton_worker.postMessage({
			type: 'coord_s',
			data: coors
		})
		//parse_skeleton(coors);
	handleNextPlElement();
}

function start_video() {
	console.log('play');
	canvasInit();
	skeleton_worker.postMessage({
		type: 'start',
		data: video.currentTime
	})
	video.play();
	video.addEventListener("pause", kill_skels, true);	//TODO temp; remove when live is implemented
}

//incoming msg from skeleton worker
skeleton_worker.onmessage = function(e) {
	var type = e.data.type;
	var data = e.data.data;

	if (typeof type === 'undefined') { //we have a skeleton set
		drawViz(e.data);
		if(!DISABLE_AUDIO){
			do_the_audio(e.data);
		}else{
			is_playing = true;
		}
	} else {
		switch (type) {
			case 'stop':
				kill_audio();
				break;
			default:
				console.log("NOTE: unwanted");
		}
	}
}

function kill_skels(){
		skeleton_worker.postMessage({
		type: 'kill',
		data: video.currentTime
	})
}