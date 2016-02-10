var open = new String('open');
var buffer_len = 0;

var video = document.getElementById('v');
window.MediaSource = window.MediaSource || window.WebKitMediaSource;
var mediaSource = new MediaSource();

var playlist_dir = '/x64/Debug/out/playlist.m3u8'



function onSourceOpen(videoTag, e) {
	var mediaSource = e.target;
	var sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42c01e"');
	videoTag.addEventListener('seeking', onSeeking.bind(videoTag, mediaSource));
	videoTag.addEventListener('progress', onProgress.bind(videoTag, mediaSource));
	var initSegment = GetInitializationSegment();
	if (initSegment == null) {
		console.log("problem with initialization!");
		// Error fetching the initialization segment. Signal end of stream with an error.
		mediaSource.endOfStream("network");
		return;
	}
	// Append the initialization segment.
	sourceBuffer.appendBuffer(initSegment);
	if (!isNaN(mediaSource.duration))
		mediaSource.duration = 1000;
	// Append some initial media data.
	appendNextMediaSegment(mediaSource);
}

function GetNextMediaSegment() {
	var buffer = buffers[0];
	buffers = buffers.slice(1);
	console.log(buffers);
	buffer_len = buffer_len + 1;
	console.log(buffer_len);
	return buffer;
}


var queue = [];

function appendNextMediaSegment(mediaSource) {
	console.log("next media segment");
	/*if (mediaSource.readyState == "ended") {
	  console.log("ended");
	  return;
	}*/
	// If we have run out of stream data, then signal end of stream.
	/*if (!HaveMoreMediaSegments()) {
	  console.log("no more media segment");
	  mediaSource.endOfStream();     
	  return;
	}*/


	var mediaSegment = GetNextMediaSegment();
	/*if (!mediaSegment) {
	  console.log("no media segment");
	  // Error fetching the next media segment.
	  mediaSource.endOfStream("network");
	  return;
	}*/

	queue.push(mediaSegment);
	if (mediaSource.sourceBuffers[0].updating) {
		mediaSource.sourceBuffers[0].addEventListener('updateend', function() {
			if (queue.length)
				mediaSource.sourceBuffers[0].appendBuffer(queue.shift());
		}, false);
	} else {
		if (queue.length)
			mediaSource.sourceBuffers[0].appendBuffer(queue.shift());
	}
}


function onSeeking(mediaSource, e) {
	console.log("seek");
	var video = e.target;
	// Abort current segment append.
	if (mediaSource.readyState == open)
		mediaSource.sourceBuffers[0].abort();
	// Notify the media segment loading code to start fetching data at the
	// new playback position.
	SeekToMediaSegmentAt(video.currentTime);
	// Append media segments from the new playback position.
	appendNextMediaSegment(mediaSource);
	appendNextMediaSegment(mediaSource);
}


function onProgress(mediaSource, e) {
	console.log("progress");
	appendNextMediaSegment(mediaSource);
}

window.setTimeout(function() {
	mediaSource.addEventListener('sourceopen', onSourceOpen.bind(this, video));
	video.src = window.URL.createObjectURL(mediaSource);
}, 1000);

function load_playlist(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener('load', function(e) {
		if (xhr.status != 200) {
			alert("Unexpected status code " + xhr.status + " for " + url);
			return false;
		}
		var regex = /^[^#].*$/mg;
		var urls = [];
		var result;
		while ((result = regex.exec(xhr.response))) {
			urls.push(result[0]);
		}

		callback(urls);
		console.log('Playlist loaded');
	});
	xhr.addEventListener('error', function() {
		console.log('Playlist load error');
	});
	xhr.open("GET", url);
	xhr.send();
}

var buffers = [];
load_playlist(playlist_dir, function(playlist_urls) {
	for (var i = 0; i < playlist_urls.length; i++) {
		GET(playlist_urls[i], function(uInt8Array) {
			var file = new Blob([uInt8Array], {
				type: 'video/mp4'
			});
			var reader = new FileReader();
			reader.onload = function(e) {
				buffers.push(new Uint8Array(e.target.result));
				console.log(buffers);
			};
			reader.readAsArrayBuffer(file);
		});
	}
});

function GetInitializationSegment() {
	console.log('init: ' + buffers.length);
	var buffer = buffers[0];
	buffers = buffers.slice(1);
	return buffer;
}


function HaveMoreMediaSegments() {
	//return false; //return buffers.length > 0;
	return buffers.length > buffer_len;
}


function GET(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';
	xhr.send();
	xhr.onload = function(e) {
		if (xhr.status != 200) {
			alert("Unexpected status code " + xhr.status + " for " + url);
			return false;
		}
		callback(new Uint8Array(xhr.response));
	};
}