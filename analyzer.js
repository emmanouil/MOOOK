var path = require("path"),
  fs = require("fs");

var ex = fs.existsSync('x64/Debug/out/playlist.m3u8');
var playlist = fs.readFileSync('x64/Debug/out/playlist.m3u8', 'utf8');

var pl_list = playlist.split(/\r\n|\r|\n/);
var coord_files = [], coord_n, sets = [];
var maxDelay = 0, syncEvents = 0, syncTime = 0;

var state = { mxD: 0, sync_events: 0, rebuff_events: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg:0 };
var states = [];
var last_frame_time = 0, rebuff_time = 0, mxSegDiff = 0;
var proj = [], dela = [];

//read from playlist elements and push the coords set in coord_n[]
for (var i = 0; i < pl_list.length; i++) {
  if (pl_list[i].endsWith('.m4s')) {
    continue;
  }
  if (pl_list[i].endsWith('.txt')) {
    coord_n = coord_files.push(fs.readFileSync(pl_list[i].toString(), 'utf8'));
  } else {
    console.log("error")
  }
}

//itterate with discarding empty lines and pushing everything in sets[]
for (var i = 0; i < coord_files.length; i++) {
  var t_in = coord_files[i].split(/\r\n|\r|\n/);
  for (var j = 0; j < t_in.length; j++) {
    if (t_in[j].length < 4) {
      continue;
    } else {
      sets.push(t_in[j].slice().toString());
    }
  }
}

var curr_seg = 0;
for (var i = 0; i < sets.length; i++) {
  var cs = sets[i].split(' ');
  for (var j = 0; j < cs.length; j++) {
    cs[j] = cs[j].split(':');
  }

  if (cs[0][1].toString().includes('PROJ')) {
    proj.push(cs);
    curr_seg = parseInt(cs[2][1]);
  } else if (cs[0][1].toString().includes('DELA')) {
    cs.push(["SEG_ORIG", curr_seg])
    dela.push(cs);
  }
}

var one = 0, two = 0 ;
for (var i = 0; i < proj.length; i++) {
  check_one(proj[i]);
}
states.push(Object.assign({}, state));
state = { mxD: 0, sync_events: 0, rebuff_events: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg:0 };
for (var i = 0; i < proj.length; i++) {
  check_three(proj[i]);
}
states.push(state);
// check_two(proj[i]);




/*
			skeleton.coordsProj[index] = item.split(':')[1].split(',').map(function(elem){
			return(parseInt(elem));
		});*/

console.log(coord_n + " elems")

//coords_in = this.responseText.split(/\r\n|\r|\n/); //split on break-line


//console.log(playlist);



//First, the intuitive player implementation, in which the video is the main stream and the playback starts as soon as the first segment arrives, regardless of the state of the secondary (coordinate) stream.
function check_one(p_in) {
  one++;
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) { //check segment (with original)
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        state.sync_events++;
        var tmp_d = dela[j][1][1] - p_in[1][1];
        if (tmp_d > state.mxD) {
          state.mxD = tmp_d
        }
        state.total_time = p_in[1][1];
        return;
      }
    }
  }
  state.missed_frames++;
}


//In the second scenario, the coordinate stream is set as the main stream, with the \texttt{MaxDelay} known in advance.
//The playback commences as soon as the \Tp~ of the coordinate buffer equals \texttt{MaxDelay}.
function check_two(p_in) {
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) {
      if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) { //check segment (with original)
        continue;
      }

      state.sync_events++;
      var tmp_d = dela[j][1][1] - p_in[1][1];
      if (tmp_d > state.mxD) {
        state.mxD = tmp_d
      }
      state.total_time = p_in[1][1];
    }
  }
}


//In the third scenario, the keep the coordinate as the main stream, with an unknown \texttt{MaxDelay} value.
//We apply a synchronization technique with elastics buffers, in which as soon as a coordinate sample arrives with delay ($D_s$) larger than the current \texttt{MaxDelay} value, a rebuffering event occurs and the \texttt{MaxDelay} value is updated to match it (i.e. if \texttt{MaxDelay}$~>D_s$, then \texttt{MaxDelay}$~:=D_s$).
//Thus, the initial \texttt{MaxDelay} value will equal the delay of the first coordinate sample.
function check_three(p_in) {
  two++;
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) {
      state.sync_events++;
      if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) {  //check segment (with original)
        state.same_seg++;
        return;
      }

      var endOfSeg = parseInt(p_in[2][1]) * 1000 - parseInt(p_in[1][1]);
      var segDiff = parseInt(dela[j][27][1]) - parseInt(p_in[2][1])

      //absolute delay
      var tmp_d = dela[j][1][1] - p_in[1][1];
      if(tmp_d>3000)console.log(tmp_d)
      if (tmp_d > state.mxD) {
        state.mxD = tmp_d;
      }

      //delay with segs in account
      var tmp_segd = 0;

      if (segDiff == 1) {
        tmp_segd = endOfSeg;
      } else if (segDiff > 1) {
        tmp_segd = endOfSeg + (segDiff - 1) * 1000
      } else {
        console.log("shouldn't be here");
      }

      if (tmp_segd > state.mxDseg) {
        state.mxDseg = tmp_segd;
        state.rebuff_events++;
      }

      if (mxSegDiff < segDiff) {
        mxSegDiff = segDiff;
        state.seg_ups++;
      }


      state.total_time = p_in[1][1];
      return;
    }
  }
  state.missed_frames++;
}