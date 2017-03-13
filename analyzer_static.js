var path = require("path"),
    fs = require("fs");

const NODE_OUT_PATH = 'x64/Debug/node_out/';
var date = new Date();
const RESULTS_FILE = date.getHours().toString() + date.getMinutes().toString() + date.getDate().toString() + date.getMonth().toString() + date.getFullYear().toString();

var ex = fs.existsSync('x64/Debug/out/playlist.m3u8');
var playlist = fs.readFileSync('x64/Debug/out/playlist.m3u8', 'utf8');


var pl_list = playlist.split(/\r\n|\r|\n/);
var coord_files = [], coord_n, sets = [];

//set at check_consistency()
var finalFrame = 0, actualFrames = 0, firstFrame = -1;
//set at check_delays()
var maxObservedDelay = 0, minObservedDelay = 99999;

var state = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };
var test_a1 = { mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0 };


var states = [];
var last_frame_time = 0, rebuff_time = 0, mxSegDiff = 0;
var proj = [], dela = [], dela_ordered = [];



/*
var loc_state = {
    mxD: 0, mnD: 9000000, matched_frames: 0, rebuff_events: 0,
    rebuff_time: 0, total_time: 0, missed_frames: 0, mxDseg: 0, seg_ups: 0, same_seg: 0,
    initBuff: Pb, finalBuff: 0
};
*/




//read from playlist elements and push the coords set in coord_n[]
for (var i = 0; i < pl_list.length; i++) {
    if (pl_list[i].endsWith('.m4s')) {
        continue;
    }
    if (pl_list[i].endsWith('.txt')) {
        coord_n = coord_files.push(fs.readFileSync(pl_list[i].toString(), 'utf8'));
    } else {
        console.log("[WARNING]playlist element " + pl_list[i] + " not parsed")
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


var test_results = [];
for (var i = 1000; i < 4000; i += 100) {
    test_results.push(check_eventsOrdered(i));
}


write(RESULTS_FILE + '_io.txt', 'InitialBuffer \t RebufTime \t RebuffEvents \t RebuffPerSec \t SmoothPlay');
for (var i = 0; i < test_results.length; i++) {
    var t = test_results[i];
    append(RESULTS_FILE + '_io.txt',
        '\n' + t.initBuff + ' \t ' + t.rebuff_time.toFixed(1) + ' \t ' + t.rebuff_events +
        ' \t ' + (t.rebuffPerSec = (t.rebuff_events / (t.total_time / 1000))) +
        ' \t ' + (t.inSyncPercent = 100 - (t.rebuff_time / t.total_time) * 100));
}




append(RESULTS_FILE + '_io.txt', '\nDuration (ms): ' + test_results[0].total_time + ' Number of frames: ' + actualFrames + ' First Frame number: ' + firstFrame + ' Last Frame number: ' + finalFrame);








/*----------- FUNCTIONS -----------*/
/*---------------------------------*/

/*----------- ANALYSIS -----------*/
/*---------------------------------*/

/**
 * return a state object with "late" frames_missed
 * 
 * frames_inTime - delayed frames where MetaFrameDelay (ms) < MetaBufferSize (ms)
 * frames_missed - delayed frames where MetaFrameDelay (ms) > MetaBufferSize (ms)
 * frames_total
 * 
 * @param {*int} Pb - the meta-buffer size (in ms)
 */
function measureMissedWithFixedVideoBuffer(Pb) {
    var loc_state = {initBuf: 0, frames_inTime: 0, frames_missed: 0, frames_delayed: 0, frames_total: 0, dur_total: 0, dur_outSynch: 0, mxD: 0, mnD: 99999};
    var bufM = Pb;
    loc_state.initBuff = Pb;

  //TODO: To
  //TODO: check with length
  iterate:
  for (var i = 0; i < actualFrames; i++) {
      loc_state.frames_total++;
    var p_in = proj[i];
    var d_in = findDelayedByFrameNo(p_in[4][1]);
    if(d_in == null){
        console.log("[WARNING] frame "+p_in[4][1]+" NOT found");
        break iterate;
    }
    if(d_in[26][1]>Pb){
        loc_state.frames_missed++;
    }else{
        loc_state.frames_inTime++;
    }
  }

  return loc_state;
}

/**
 * return a state object with "late" frames_missed (causing video to pause)
 * 
 * frames_inTime - delayed frames where MetaFrameDelay (ms) < VariableVideoBufferSize(ms) < MetaBufferSize (ms)
 * frames_delayed - delayed frames where MetaFrameDelay (ms) > VariableVideoBufferSize(ms) < MetaBufferSize (ms)
 * frames_missed - delayed frames where MetaFrameDelay (ms) > MetaBufferSize (ms)
 * frames_total
 * 
 * @param {*int} Pb - the meta-buffer size (in ms)
 */
function measureMissedWithElasticVideoBuffer(Pb) {
    var loc_state = {initBuf: 0, frames_inTime: 0, frames_missed: 0, frames_delayed: 0, frames_total: 0, dur_total: 0, dur_outSynch: 0, mxD: 0, mnD: 99999};
    var Vb = VIDEO_BUFFER_SIZE;
    loc_state.initBuff = Pb;

  //TODO: To
  //TODO: check with length
  iterate:
  for (var i = 0; i < actualFrames; i++) {
      loc_state.frames_total++;
    var p_in = proj[i];
    var d_in = findDelayedByFrameNo(p_in[4][1]);
    if(d_in == null){
        console.log("[WARNING] frame "+p_in[4][1]+" NOT found");
        break iterate;
    }
    if(d_in[26][1]>Pb){
        loc_state.frames_missed++;
    }else if(d_in[26][1]>Vb){
        loc_state.frames_delayed++;
        Vb = d_in[26][1];
    }else{
        loc_state.frames_inTime++;
    }
  }

  return loc_state;
}


/*-- helper analysis functions --*/
function check_consistency() {
    var initFrn = 0;

    for (var i = 0; i < proj.length; i++) {
        proj[i][1][1] = parseFloat(proj[i][1][1]);  //time to float
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
                if (firstFrame == -1) {
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

function check_delays() {
    var local_delay = 0;
    for (var i = 0; i < actualFrames; i++) {
        p_in = proj[i];
        if (p_in[4][1] > finalFrame) {
            console.log("[ERROR] more frames than not");
        }

        for (var j = 0; j < dela.length; j++) {
            //TODO: move the two following lines where dela parsing occurs
            dela[j][1][1] = parseFloat(dela[j][1][1]);
            dela[j][26][1] = parseFloat(dela[j][26][1]);
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




/*----------- HELPER -----------*/
/*---------------------------------*/
/**
 * Return the frame with the respective frame no. <frn>
 * @param {int} frn to look up in the delayed frames
 * @returns {Object} returns frame with <frn> number, null if frame not found
 */
function findDelayedByFrameNo(frn){
    for(var i =0; i<dela.length; i++){
        if(dela[i][4][1] == frn)
            return dela[i];
    }
    return null;
}

/**
 * Sorts <array> according to <index>
 * @param {Array} array to be sorted
 * @param {Integer} index according to which be sorted
 */
function bubbleSortArray(array, index) {
    var swapped;
    do {
        swapped = false;
        for (var i = 0; i < array.length - 1; i++) {
            if (array[i][index] > array[i + 1][index]) {
                var temp = array[i];
                array[i] = array[i + 1];
                array[i + 1] = temp;
                swapped = true;
            }
        }
    } while (swapped);
}

function write(filename, data) {
    var file = NODE_OUT_PATH + filename;
    fs.writeFileSync(file, data, { encoding: null, flags: 'w' });
}

function append(filename, data) {
    var file = NODE_OUT_PATH + filename;
    fs.appendFileSync(file, data, { encoding: null, flags: 'a' });
}