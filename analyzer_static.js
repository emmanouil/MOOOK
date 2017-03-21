var path = require("path"),
    fs = require("fs");

const NODE_OUT_PATH = 'x64/Debug/node_out/';
var date = new Date();
const RESULTS_FILE = date.getHours().toString() + date.getMinutes().toString() + date.getDate().toString() + date.getMonth().toString() + date.getFullYear().toString();

var ex = fs.existsSync('x64/Debug/out/playlist.m3u8');
var pl_list = fs.readFileSync('x64/Debug/out/playlist.m3u8', 'utf8').split(/\r\n|\r|\n/);


var coord_files = [], coord_n, sets = [];

//constants
const VIDEO_BUFFER_SIZE = 1000; //in ms
const META_BUFFER_PLAY_THRESHOLD_MIN = 1000; //in ms
const META_BUFFER_PLAY_THRESHOLD_MAX = 4000; //in ms
const TEST_DURATION = 50000; //in ms
const CLOCK_RESOLUTION = 10; //in ms

//set at check_consistency()
var finalFrame = 0, finalTimeStamp = 0, actualFrames = 0, firstFrame = -1, firstTimestamp = 0;
//set at check_delays()
var maxObservedDelay = 0, minObservedDelay = 99999;

var states = [];
var proj = [], dela = [], dela_ordered = [], video_ordered = [];

function Buffer(initSize = 0, type){
    this.contents = [];
    this.contents.sorted = false;
    this.index = 0;
    this.sizeInFrames = 0;
    this.sizeInSec = 0;
    this.sizePlay = initSize;
    this.status = 'NEW';    //NEW / PLAYING / STOPPED
    this.type = type;
    this.t_low = 99999999999999;
    this.t_high= 0;

    this.push = function(element){
        if(this.type == 'DELA'){
            element.valid = false;
        }else if(this.type == 'VID'){
            element.valid = true;
            //do nothing
        } else {
            console.log('[ERROR] unknown buffer element');
        }
        this.contents.push(element);
        this.contents.sorted = false;
    }

    this.update = function () {
        this.validate();
        this.updateAttrs();
        this.updateStatus();
    }


    this.validate = function () {
        //validate META frames
        if (this.type == 'DELA') {
            var updating = true;
            while (updating) {
                updating = false;
                this.contents.forEach(function (element) {
                    if (dela_list[dela_list_index].FRN == element.FRN) {
                        dela_list_index++;
                        updating = true;
                        element.valid = true;
                    }
                });
            }
        }
    }

    this.updateAttrs = function () {

        this.t_low = 99999999999999; //reset t_low in case we popped frames
        this.contents.forEach(function (element) {
            if (element.valid) {
                if (element.T < this.t_low) this.t_low = element.T;
                if (element.T > this.t_high) this.t_high = element.T;
                this.sizeInSec = this.t_high - this.t_low;
                this.sizeInFrames = this.contents.length;
            }
        }, this);
    }

    this.updateStatus = function () {
        //update buffer status
        if (this.status == 'NEW' && this.sizeInSec >= this.sizePlay) {
            this.status = 'PLAYING';
            console.log(this.type + ' buffer is playing  - time:' + clock.timeNow);
        } else if (this.status == 'PLAYING' && (this.contents.length == 0 || this.contents[0].valid == false)) {
            this.status = 'STOPPED';
            console.log(this.type + ' buffer is stopping  - time:' + clock.timeNow);
        } else if (this.status == 'STOPPED' && (this.contents.length > 0 && this.contents[0].valid == true)) {
            this.status = 'PLAYING';
            console.log('playing ' + this.type)
        }
    }



    this.use = function (clock) {
        this.contents.forEach(function (element, index, array) {
            if (clock.timeNow >= (element.T + this.sizePlay) && this.status == 'PLAYING') {
                // console.log(this.type+' frame removed. new size: '+(array.length-1));
                array.splice(index, 1)
                //                console.log('removed '+array.splice(index, 1)+' at time '+clock.timeNow);
                this.update();
            }
        }, this);
    }

}

function Clock(initTime){
    this.timeZero = initTime;
    this.timeNow = initTime;
    this.duration = 0;
    this.tick = function(delta_in){
        this.timeNow += delta_in;
        this.duration = this.timeNow - this.timeZero;
    }
    this.reset = function(){
    this.timeNow = this.timeZero;
    this.duration = 0;
    }
}



parse_playlist();   //results in proj[] and dela[]

//bubble sort to delayed coords
dela_ordered = dela.slice(0);
bubbleSortArray(dela_ordered, 4); //sort according to FRN


//check that everything is as supposed to be (regarding the dataset)
//TODO check from here
var last_dela_frame = dela_ordered[dela_ordered.length-1];
var first_dela_frame = dela_ordered[0]
firstTimestamp = first_dela_frame[28][1];
finalTimeStamp = last_dela_frame[28][1];
actualFrames = dela_ordered.length;
finalFrame = last_dela_frame[4][1];

/*
var a_ok = check_consistency();
console.log((a_ok ? '[A-OK]' : '[WARNING] possible error'));
console.log("actual frames " + actualFrames + " last frame no: " + finalFrame);
*/
//TODO to here

check_delays();
generate_video_frames();
var clock = new Clock(video_ordered[0].T);



//test scenario #1 - missed frames - fixed video buffer
var test_resultsFixed = [];
for (var i = META_BUFFER_PLAY_THRESHOLD_MIN; i < META_BUFFER_PLAY_THRESHOLD_MAX; i += 100) {
    test_resultsFixed.push(measureMissedWithFixedVideoBuffer(i));
}

//test scenario #2 - pause events (delayed frames) - elastic video buffer
var test_resultsElastic = [];
for (var i = META_BUFFER_PLAY_THRESHOLD_MIN; i < META_BUFFER_PLAY_THRESHOLD_MAX; i += 100) {
    test_resultsElastic.push(measureMissedWithElasticVideoBuffer(i));
}


write(RESULTS_FILE + '_FIXED_io.txt', 'InitialBuffer \t FramesInTime \t FramesMissed');
for (var i = 0; i < test_resultsFixed.length; i++) {
    var t = test_resultsFixed[i];
    append(RESULTS_FILE + '_FIXED_io.txt',
        '\n' + t.initBuff + ' \t ' + t.frames_inTime + ' \t ' + t.frames_missed);
}

write(RESULTS_FILE + '_ELASTIC_io.txt', 'InitialBuffer \t FramesInTime \t FramesDelayed \t FramesMissed');
for (var i = 0; i < test_resultsElastic.length; i++) {
    var t = test_resultsElastic[i];
    append(RESULTS_FILE + '_ELASTIC_io.txt',
        '\n' + t.initBuff + ' \t ' + t.frames_inTime + ' \t ' + t.frames_delayed + ' \t ' + t.frames_missed);
}

console.log("done")
//append(RESULTS_FILE + '_io.txt', '\nDuration (ms): ' + test_results[0].total_time + ' Number of frames: ' + actualFrames + ' First Frame number: ' + firstFrame + ' Last Frame number: ' + finalFrame);








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
    var loc_state = { initBuf: 0, frames_inTime: 0, frames_missed: 0, frames_delayed: 0, frames_total: 0, dur_total: 0, dur_outSynch: 0, mxD: 0, mnD: 99999 };
    var bufM = Pb;
    loc_state.initBuff = Pb;

    //TODO: To
    //TODO: check with length
    iterate:
    for (var i = 0; i < actualFrames; i++) {
        loc_state.frames_total++;
        var p_in = proj[i];
        var d_in = findDelayedByFrameNo(p_in[4][1]);
        if (d_in == null) {
            console.log("[WARNING] frame " + p_in[4][1] + " NOT found");
            break iterate;
        }
        if (d_in[26][1] > Pb) {
            loc_state.frames_missed++;
        } else {
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
    var loc_state = { initBuf: 0, frames_inTime: 0, frames_missed: 0, frames_delayed: 0, frames_total: 0, dur_total: 0, dur_outSynch: 0, mxD: 0, mnD: 99999 };
    var Vb = VIDEO_BUFFER_SIZE;
    loc_state.initBuff = Pb;

    //TODO: To
    //TODO: check with length
    iterate:
    for (var i = 0; i < actualFrames; i++) {
        loc_state.frames_total++;
        var p_in = proj[i];
        var d_in = findDelayedByFrameNo(p_in[4][1]);
        if (d_in == null) {
            console.log("[WARNING] frame " + p_in[4][1] + " NOT found");
            break iterate;
        }
        if (d_in[26][1] > Pb) {
            loc_state.frames_missed++;
        } else if (d_in[26][1] > Vb) {
            loc_state.frames_delayed++;
            Vb = d_in[26][1];
        } else {
            loc_state.frames_inTime++;
        }
    }

    return loc_state;
}


/*-- helper analysis functions --*/
function parse_playlist() {


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
            cs[4][1] = parseInt(cs[4][1]);
            cs[2][1] = parseInt(cs[2][1]);
            proj.push(cs);
            curr_seg = cs[2][1]
        } else if (cs[0][1].toString().includes('DELA')) {
            cs.push(["SEG_ORIG", curr_seg])
            cs[4][1] = parseInt(cs[4][1]);
            cs[1][1] = parseInt(cs[1][1]);
            cs[26][1] = parseInt(cs[26][1]);
            cs.push(["T_D", cs[1][1]-cs[26][1]])
            dela.push(cs);
        }
    }

}

function check_delays() {
    minObservedDelay =  maxObservedDelay = first_dela_frame[26][1];
    for (var i = 0; i < dela_ordered.length; i++) {
        var local_delay = dela_ordered[i][26][1];
        if (minObservedDelay > local_delay) {
            minObservedDelay = local_delay;
        }
        if (maxObservedDelay < local_delay) {
            maxObservedDelay = local_delay;
        }
    }
}

function generate_video_frames(){
    var frn_t = 0;
    for(var i = Math.ceil(firstTimestamp); i<Math.floor(finalTimeStamp); i += 33){
        video_ordered.push({TYPE: 'VID', T: i, FRN: frn_t});
        frn_t++;
    }
}

function check_video_qeue(){
    var i_out = [];
    var out = [];
    video_ordered.forEach(function(element, index){
        if(element.T <= clock.timeNow) i_out.push(index);
    });
    i_out.forEach(function(element){
        out.push(video_ordered.splice(element, 1)[0]);
    })
    return out;
}

function check_meta_list(){
    dela_list.forEach(function(element, index){
        if(element.T_arrival <= clock.timeNow){
            dela_list[index].contents = findDelayedByFrameNo(element.FRN);
        }
    });
}

/*
function check_meta_qeue(){
    var i_out = [];
    var out = [];
    dela_ordered.forEach(function(element, index){
        if(element[1][1] <= clock.timeNow) i_out.push(index);
    });
    i_out.forEach(function(element){
        out.push(dela_ordered.splice(element, 1)[0]);
    })
    return out;
}
*/

/*----------- HELPER -----------*/
/*---------------------------------*/
/**
 * Return the frame with the respective frame no. <frn>
 * @param {int} frn to look up in the delayed frames
 * @returns {Object} returns frame with <frn> number, null if frame not found
 */
function findDelayedByFrameNo(frn) {
    for (var i = 0; i < dela.length; i++) {
        if (dela[i][4][1] == frn)
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
    if(typeof(array.sorted) != 'undefined')
        array.sorted = true;

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