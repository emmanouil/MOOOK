var path = require("path"),
  fs = require("fs");

const NODE_PATH = 'x64/Debug/node_out/';
var date = new Date();
const RESULTS_FILE = date.getHours().toString()+date.getMinutes().toString()+date.getDate().toString()+date.getMonth().toString()+date.getFullYear().toString();

var ex = fs.existsSync('x64/Debug/out/playlist.m3u8');
var playlist = fs.readFileSync('x64/Debug/out/playlist.m3u8', 'utf8');


var pl_list = playlist.split(/\r\n|\r|\n/);
var coord_files = [], coord_n, sets = [];
var maxDelay = 0, syncEvents = 0, syncTime = 0;

//set at check_consistency()
var finalFrame = 0, actualFrames = 0, firstFrame = -1;
//set at check_delays()
var maxObservedDelay = 0, minObservedDelay = 99999;

var state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };
var test_a1 = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };


var states = [];
var last_frame_time = 0, rebuff_time = 0, mxSegDiff = 0;
var proj = [], dela = [], dela_ordered = [];

//read from playlist elements and push the coords set in coord_n[]
for (var i = 0; i < pl_list.length; i++) {
  if (pl_list[i].endsWith('.m4s')) {
    continue;
  }
  if (pl_list[i].endsWith('.txt')) {
    coord_n = coord_files.push(fs.readFileSync(pl_list[i].toString(), 'utf8'));
  } else {
    console.log("[WARNING]playlist element "+pl_list[i]+" not parsed")
  }
}

//itterate coord_n[] with discarding empty lines and pushing everything in sets[]
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


//iterate sets and separate proj[] and dela[]
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

//bubble sort to delayed coords
dela_ordered = dela.slice(0);
bubbleSortArray(dela_ordered, 4); //sort according to FRN


//check that everything is as supposed to be (regarding the dataset)
var a_ok = check_consistency();
console.log((a_ok ? '[A-OK]' : '[WARNING] possible error'));
console.log("actual frames " + actualFrames + " last frame no: " + finalFrame);

count_occurences();

check_delays();

/*
var test_results = [];
for(var i =1000; i<4000; i+=100){
 test_results.push(check_eventsOoO(i));
}

write(RESULTS_FILE+'.txt', 'InitialBuffer \t RebufTime \t RebuffEvents \t RebuffPerSec \t InSyncPercent');
for (var i = 0; i < test_results.length; i++) {
  var t = test_results[i];
  append(RESULTS_FILE+'.txt',
    '\n' + t.initBuff + ' \t ' + t.rebuff_time.toFixed(1) + ' \t ' + t.rebuff_events+
    ' \t '+(t.rebuffPerSec = (t.rebuff_events/(t.total_time/1000))) +
    ' \t '+(t.inSyncPercent = 100 - (t.rebuff_time/t.total_time)*100));
}

append(RESULTS_FILE+'.txt', '\nDuration (ms): '+test_results[0].total_time+' Number of frames: '+actualFrames+' First Frame number: '+firstFrame+' Last Frame number: '+finalFrame);
*/


var test_results = [];
for(var i =1000; i<4000; i+=100){
 test_results.push(check_eventsOrdered(i));
}

write(RESULTS_FILE+'_io.txt', 'InitialBuffer \t RebufTime \t RebuffEvents \t RebuffPerSec \t SmoothPlay');
for (var i = 0; i < test_results.length; i++) {
  var t = test_results[i];
  append(RESULTS_FILE+'_io.txt',
    '\n' + t.initBuff + ' \t ' + t.rebuff_time.toFixed(1) + ' \t ' + t.rebuff_events+
    ' \t '+(t.rebuffPerSec = (t.rebuff_events/(t.total_time/1000))) +
    ' \t '+(t.inSyncPercent = 100 - (t.rebuff_time/t.total_time)*100));
}




append(RESULTS_FILE+'_io.txt', '\nDuration (ms): '+test_results[0].total_time+' Number of frames: '+actualFrames+' First Frame number: '+firstFrame+' Last Frame number: '+finalFrame);








//do the analysis of the coords
var b1 = 0, b2 = 0, a1 = 0, a2 = 0, a3 = 0;

check_one();
states.push(Object.assign({}, state));
state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };
check_two();
states.push(Object.assign({}, state));
state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };




for (var i = 0; i < proj.length; i++) {
  check_oneOLD(proj[i]);
}
states.push(Object.assign({}, state));
state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };
for (var i = 0; i < proj.length; i++) {
  check_three(proj[i]);
}
states.push(state);



check_two();
states.push(Object.assign({}, state));
state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };


// check_two(proj[i]);




/*
			skeleton.coordsProj[index] = item.split(':')[1].split(',').map(function(elem){
			return(parseInt(elem));
		});*/

console.log(coord_n + " elems")

//coords_in = this.responseText.split(/\r\n|\r|\n/); //split on break-line


//console.log(playlist);



function check_consistency() {
  var initFrn = 0;

  for (var i = 0; i < proj.length; i++) {
    if (initFrn < proj[i][4][1]) {
      initFrn = proj[i][4][1];
    } else {
      console.log('[WARNING] possible framecount error');
    }
  }

  var lastFrn = 0;
  for (var i = 0; i < proj.length; i++) {
    var tmpFrn = 0;
    dela.forEach(function (element) {
      if (element[4][1] == proj[i][4][1]) {
        tmpFrn = element[4][1];
        if(firstFrame==-1){
          firstFrame = tmpFrn;
        }
      }
    });

    if (tmpFrn == 0) {
      finalFrame = lastFrn;
      return true;
    } else {
      actualFrames++;
      lastFrn = tmpFrn;
    }
  }
  return false;
}



function count_occurences() {
  var delays = [];
  for (var i = 0; i < 50; i++) {
    delays.push(parseInt(0));
  }
  for (var i = 0; i < actualFrames; i++) {
    var slot = parseInt((dela[i][26][1]) / 100);
    delays[slot]++;
  }
  var tost = '';
  for (var i = 0; i < delays.length; i++) {
    tost += delays[i].toString() + '\n';
  }
  //write('calcu.txt',tost);
  return;
}


function write(filename, data) {
  var file = NODE_PATH + filename;
  fs.writeFileSync(file, data, {encoding: null, flags: 'w'});
}

function append(filename, data){
  var file = NODE_PATH + filename;
  fs.appendFileSync(file, data, {encoding: null, flags: 'a'});
}


function check_delays() {
  var local_delay = 0;
  for (var i = 0; i < actualFrames; i++) {
    p_in = proj[i];
    if (p_in[4][1] > finalFrame) {
      console.log("[ERROR] more frames than not");
    }

    for (var j = 0; j < dela.length; j++) {
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) {  //check frame no.
        local_delay = dela[j][1][1] - p_in[1][1];
        break;
      }
    }

    if (minObservedDelay > local_delay) {
      minObservedDelay = local_delay;
    }

    if (maxObservedDelay < local_delay) {
      maxObservedDelay = local_delay;
    }

  }
}



/**
 * return a state object with out of synch missed_frames
 * 
 * @param {*int} Pb - the meta-buffer size (in ms)
 */
function check_eventsOoO(Pb){
  var loc_state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0,
     rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0,
      initBuff: Pb, finalBuff: 0};
  var bufD = Pb;
  var t_inSync =0, f_inSync=0;
  var t_smooth =0, f_smooth =0;
  var local_time =0;

  //TODO: check with length
  for (var i = 0; i < actualFrames; i++) {
    var p_in = proj[i];
    local_time = p_in[1][1];

    iterate:
    for (var j = 0; j < dela.length; j++) {
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        var d_in = dela[j];
        loc_state.matched_frames++;
        var tmp_d = d_in[1][1] - p_in[1][1];

        if (tmp_d > bufD) {
          loc_state.rebuff_events++;
          loc_state.rebuff_time += tmp_d - bufD;
          bufD = tmp_d;
        }
        break iterate;
      }
    }
    loc_state.total_time = p_in[1][1] - proj[0][1][1];
  }
  loc_state.finalBuff = bufD;
  return loc_state;
}





/**
 * return a state object with out of synch missed_frames
 * 
 * @param {*int} Pb - the meta-buffer size (in ms)
 */
function check_eventsOrdered(Pb) {
  const VIDEO_BUFFER = 1000;
  var loc_state = {
    mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0,
    rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0,
    initBuff: Pb, finalBuff: 0, inSync: 0, synced: 0
  };
  var bufD = Pb;
  var bufferE = [];
  var t_inSync = 0, f_inSync =0;
  var f_synced = 0;
  var t_smooth = 0, f_smooth = 0;
  var tDiff = 0;
  var normalTime = 0;
  var local_time = parseFloat(proj[0][1][1]); //init timeline to first frame
  var To = parseFloat(dela_ordered[0][1][1]) - parseFloat(dela_ordered[0][26][1]);


  //TODO: To
  //TODO: check with length
  for (var i = 0; i < actualFrames; i++) {
    //current on-time frame
    proj[i][1][1] = parseFloat(proj[i][1][1]);
    var p_in = proj[i];
    //update time diff from last displayed frame
    tDiff = p_in[1][1] - local_time;
    //update timeline indicator 
    local_time = p_in[1][1];
    //update buffer
    //bufD += tDiff;

    //find delayed frame
    iterate:
    for (var j = 0; j < dela_ordered.length; j++) {
      if (parseInt(dela_ordered[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        dela_ordered[j][1][1] = parseFloat(dela_ordered[j][1][1]);
        var d_in = dela_ordered[j];
        loc_state.matched_frames++;
        var tmp_d = d_in[1][1] - local_time - bufD;

        //buffer check
        bufferE.push(d_in);
        if (bufferE[0][1][1] > (local_time + bufD)) {
          loc_state.missed_frames++;
          loc_state.rebuff_time += tDiff;
          if (bufferE.length == 1) {
            loc_state.rebuff_events++;
          }
        } else {
          var trim = 0;
          bufferBreak:
          for (var k = 0; k < bufferE.length; k++) {
            /*
            if (bufferE[bufferE.length - 1][4][1] == d_in[4][1]) {
              bufferE = [];
              f_inSync++;
              break bufferBreak;
            }*/
            if (bufferE[k][1][1] <= (local_time + bufD)){
              trim++;
              //check if in sync w/ video
              if(parseInt(bufferE[k][4][1]) === parseInt(p_in[4][1])){
                f_inSync++;
              }
              //check if we empty the buffer
              if(trim == bufferE.length){
                bufferE = [];
                f_synced++;
                break bufferBreak;
              }
            } else {
              break bufferBreak;
            }
          }
          if (trim > 0) {
            bufferE.splice(0, trim);
            trim = 0;
          }
        }

        /*
        var tmp_d = d_in[1][1] - local_time - VIDEO_BUFFER;

        if (tmp_d > bufD) {
          loc_state.rebuff_events++;
          loc_state.rebuff_time += (tmp_d - bufD);
          screwedTime += tmp_d - bufD
          bufD = 0;
        }else{
          bufD += tmp_d;
        }
        */
        break iterate;
      }
    }
    loc_state.total_time = p_in[1][1] - proj[0][1][1];
  }
  loc_state.finalBuff = bufD;
  console.log('synced frames (smooth): ' + (loc_state.synced = f_synced));
  console.log('in sync (with video) frames: ' + (loc_state.inSync = f_inSync));
  return loc_state;
}





//function seek_catchup_frames


/**
 * First scenario:
 * 1s initial buffer
 * on event: rebuffer
 * measure: % time in sync, rebuff events, rebuff time, accumulated jitter
 */
/*
function check_a1(p_in) {
  a1 =0;
  test_a1 = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0};
  for (var i = 0; i < proj.length; i++) {


    a1++;
  }
}
*/


//First, the intuitive player implementation, in which the video is the main stream and the playback starts as soon as the first segment arrives, regardless of the state of the secondary (coordinate) stream.
//no catch-up - buffer 1s
function check_one() {
  var bufD = 1000;
  var bufA = 1000;
  for (var i = 0; i < proj.length; i++) {
    p_in = proj[i];
    for (var j = 0; j < dela.length; j++) {
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        state.matched_frames++;
        var tmp_d = dela[j][1][1] - p_in[1][1];
        if (tmp_d > bufD) {
          state.total_time = p_in[1][1] - proj[0][1][1];
          return;
        }
      }
    }
  }
}


//First, the intuitive player implementation, in which the video is the main stream and the playback starts as soon as the first segment arrives, regardless of the state of the secondary (coordinate) stream.
//buffer roses, same as speedup
function check_two() {
  var bufD = 1000;
  var bufA = 1000;
  for (var i = 0; i < proj.length; i++) {
    p_in = proj[i];
    for (var j = 0; j < dela.length; j++) {
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        state.matched_frames++;
        var tmp_d = dela[j][1][1] - p_in[1][1];
        if (tmp_d > bufD) {
          state.rebuff_events++;
          state.rebuff_time += tmp_d - bufD;
          bufD = tmp_d;
        }
      }
    }
    state.total_time = p_in[1][1] - proj[0][1][1];
  }
}



// --- OLD SCENARIOS ---
function check_oneOLD(p_in) {
  b1++;
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) { //check segment (with original)
      if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) { //check frame
        state.matched_frames++;
        var tmp_d = dela[j][1][1] - p_in[1][1];
        if (tmp_d > state.mxD) {
          state.mxD = tmp_d
        }
        if (tmp_d < state.mnD) {
          state.mnD = tmp_d;
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
function check_twoOLD(p_in) {
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) {
      if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) { //check segment (with original)
        continue;
      }

      state.matched_frames++;
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
  b2++;
  for (var j = 0; j < dela.length; j++) {
    if (parseInt(dela[j][4][1]) === parseInt(p_in[4][1])) {
      state.matched_frames++;
      if (parseInt(dela[j][27][1]) === parseInt(p_in[2][1])) {  //check segment (with original)
        state.same_seg++;
        return;
      }

      var endOfSeg = parseInt(p_in[2][1]) * 1000 - parseInt(p_in[1][1]);
      var segDiff = parseInt(dela[j][27][1]) - parseInt(p_in[2][1])

      //absolute delay
      var tmp_d = dela[j][1][1] - p_in[1][1];
      if (tmp_d > 3000) console.log(tmp_d)
      if (tmp_d > state.mxD) {
        state.mxD = tmp_d;
      }
      if (tmp_d < state.mnD) {
        state.mnD = tmp_d;
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

/**
 * Sorts <array> according to <index>
 * @param {Array} array to be sorted
 * @param {Integer} index according to which be sorted
 */
function bubbleSortArray(array, index)
{
    var swapped;
    do {
        swapped = false;
        for (var i=0; i < array.length-1; i++) {
            if (array[i][index] > array[i+1][index]) {
                var temp = array[i];
                array[i] = array[i+1];
                array[i+1] = temp;
                swapped = true;
            }
        }
    } while (swapped);
}