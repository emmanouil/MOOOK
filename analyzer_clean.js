//imports
var path = require("path"),
    fs = require("fs");

//file-out setup
const NODE_OUT_PATH = 'x64/Debug/node_out/';
var date = new Date();
const RESULTS_FILE = date.getHours().toString() + date.getMinutes().toString() + date.getDate().toString() + date.getMonth().toString() + date.getFullYear().toString();

//file-in setup
var ex = fs.existsSync('x64/Debug/out/playlist.m3u8');
var pl_list = fs.readFileSync('x64/Debug/out/playlist.m3u8', 'utf8').split(/\r\n|\r|\n/);
var coord_files = [], coord_n, sets = [];   //vars used for playlist parsing

//constants
const VIDEO_BUFFER_SIZE = 1000; //in ms
const META_BUFFER_PLAY_THRESHOLD_MIN = 1000; //in ms
const META_BUFFER_PLAY_THRESHOLD_MAX = 4000; //in ms
const TEST_DURATION = 40000; //in ms
const CLOCK_RESOLUTION = 10; //in ms

//set at check_consistency()
var finalFrame = 0, finalTimeStamp = 0, actualFrames = 0, firstFrame = -1, firstTimestamp = 0;
//set at check_delays()
var maxObservedDelay = 0, minObservedDelay = 99999;

//other vars
var proj = [], dela = [], dela_ordered = [], video_ordered = [];

//Objects
function Buffer(initSize = 0, type) {
    this.contents = [];
    this.contents.sorted = false;
    this.sizeInFrames = 0;
    this.sizeInSec = 0;
    this.sizePlay = initSize;
    this.status = 'NEW';    //NEW / PLAYING / STOPPED
    this.lastBuffStart = 0;
    this.lastBuffStop = 0;
    this.type = type;
    this.t_low = 99999999999999;
    this.t_high = 0;
    this.has_valid = false;

    this.push = function (element) {
        if (this.type == 'DELA') {
            element.valid = false;
        } else if (this.type == 'VID') {
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
        this.hasValid();
        this.updateStatus();
    }


    this.validate = function () {
        //validate META frames
        if (this.type == 'DELA') {
            if (this.contents.length > 1)
                bubbleSortArrayByProperty(this.contents, 'FRN');
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

        if (this.contents.length == 0) return;

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

    this.hasValid = function () {
        this.contents.forEach(function (elem) {
            if (elem.valid)
                this.has_valid = true;
        }, this);
    }

    this.updateStatus = function () {
        //update buffer status
        if (this.status == 'NEW' && this.sizeInSec >= this.sizePlay) {
            this.status = 'PLAYING';
            this.sizePlay = clock.timeNow - clock.timeZero;
            console.log(this.type + ' buffer is playing  - time:' + clock.timeNow);
        } else if (this.status == 'PLAYING' && (this.contents.length == 0 || this.contents[0].valid == false)) {
            this.status = 'STOPPED';
            this.lastBuffStart = clock.timeNow;
            console.log(this.type + ' buffer is stopping  - time:' + clock.timeNow + '   size in ms ' + this.sizeInSec);
        } else if (this.status == 'STOPPED' && ((this.contents.length > 0) && this.has_valid)) {
            this.status = 'PLAYING';
            this.lastBuffStop = clock.timeNow;
            this.sizePlay = this.lastBuffStop - this.lastBuffStart;
            console.log(this.type + ' buffer is playing ' + clock.timeNow + '   size in ms ' + this.sizeInSec);
        }
    }

    this.use = function (clock) {
        var removed = true;
        while (removed) {
            removed = false;
            for (var i = 0; i < this.contents.length; i++) {
                element = this.contents[i];
                if (clock.timeNow >= (element.T + this.sizePlay) && this.status == 'PLAYING' && element.valid) {
                    this.contents.splice(i, 1);
                    this.has_valid = false;
                    removed = true;
                    break;
                }
            }
        }
        this.update();
    }

}

function Clock(initTime) {
    this.timeZero = initTime;
    this.timeNow = initTime;
    this.duration = 0;
    this.tick = function (delta_in) {
        this.timeNow += delta_in;
        this.duration = this.timeNow - this.timeZero;
    }
    this.reset = function () {
        this.timeNow = this.timeZero;
        this.duration = 0;
    }
}

//Actual execution entry point

parse_playlist();   //results in proj[] and dela[]

//bubble sort to delayed coords
dela_ordered = dela.slice(0);
bubbleSortArray(dela_ordered, 4); //sort according to FRN


//check that everything is as supposed to be (regarding the dataset)
var last_dela_frame = dela_ordered[dela_ordered.length - 1];
var first_dela_frame = dela_ordered[0];
firstTimestamp = first_dela_frame[28][1];
finalTimeStamp = last_dela_frame[28][1];
actualFrames = dela_ordered.length;
finalFrame = last_dela_frame[4][1];

check_delays();
generate_video_frames();
var clock = new Clock(video_ordered[0].T);

var test_buffer = [];
for (var i_test = META_BUFFER_PLAY_THRESHOLD_MIN; i_test < META_BUFFER_PLAY_THRESHOLD_MAX; i_test += 100) {
    //for resetting qeues
    var video_ordered_tmp = video_ordered.slice(0);
    var dela_ordered_tmp = dela_ordered.slice(0);
    var proj_tmp = proj.slice(0);

    var dela_list = [];
    var dela_list_index = 0;
    for (var i_a = 0; i_a < dela_ordered.length; i_a++) {
        var elem = dela_ordered[i_a];
        var item = {};
        item.T_arrival = elem[1][1];
        item.T_display = elem[28][1];
        item.T = item.T_display;    //TODO remove this and update it on video frames
        item.FRN = elem[4][1];
        item.contents = -1; //empty
        item.inBuffer = false;
        dela_list.push(item);
    }

    var video_buffer = new Buffer(VIDEO_BUFFER_SIZE, 'VID');
    var meta_buffer = new Buffer(i_test, 'DELA');

    var v_s = 'NEW', v_m = 'NEW';

    write(RESULTS_FILE + '_FIXED_io_' + i_test + '.txt', 'Time \t VidFramesInSec \t MetaFramesInSec');

    while (clock.duration < TEST_DURATION) {
        //FIRST do the video
        var vid_to_B = check_video_qeue();        //check for new frames
        if (typeof vid_to_B != 'undefined') vid_to_B.forEach(function (element) { video_buffer.push(element); });    //push to buffer
        video_buffer.update();  //update buffer status and attributes
        video_buffer.use(clock);    //use frames


        //SECOND do the meta
        //check for new frames
        //var meta_to_B = check_meta_qeue();
        check_meta_list();  //change contents of dela_list from -1 to actual
        //push to buffer
        //if(typeof meta_to_B != 'undefined') meta_to_B.forEach(function(element){meta_buffer.push(element);});
        dela_list.forEach(function (element, index) {
            if (element.contents != -1 && element.inBuffer == false) {
                meta_buffer.push(element);
                element.inBuffer = true;
            }
        });
        //update buffer status and attributes
        meta_buffer.update();
        //use frames
        meta_buffer.use(clock);

        //check buffers status

        //update time
        //console.log(clock.timeNow + " time and size: " + meta_buffer.sizeInSec);
        clock.tick(CLOCK_RESOLUTION);
        append(RESULTS_FILE + '_FIXED_io_' + i_test + '.txt', '\n' + clock.duration + '\t' + video_buffer.sizeInSec + '\t' + meta_buffer.sizeInSec);
    }
    console.log('done');
    /*
    reset clock
    reset buffer
    //reset qeues
    var video_ordered_tmp = video_ordered.slice(0);
    var dela_ordered_tmp = dela_ordered_tmp.slice(0);
    */

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
            cs.push(["T_D", cs[1][1] - cs[26][1]])
            dela.push(cs);
        }
    }

}


function check_delays() {
    minObservedDelay = maxObservedDelay = first_dela_frame[26][1];
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


function generate_video_frames() {
    var frn_t = 0;
    for (var i = Math.ceil(firstTimestamp); i < Math.floor(finalTimeStamp); i += 33) {
        video_ordered.push({ TYPE: 'VID', T: i, FRN: frn_t });
        frn_t++;
    }
}

function check_video_qeue() {
    var i_out = [];
    var out = [];
    video_ordered.forEach(function (element, index) {
        if (element.T <= clock.timeNow) i_out.push(index);
    });
    i_out.forEach(function (element) {
        out.push(video_ordered.splice(element, 1)[0]);
    })
    return out;
}

function check_meta_list() {
    dela_list.forEach(function (element, index) {
        if (dela_list[index].contents == -1) {
            if (element.T_arrival <= clock.timeNow) {
                dela_list[index].contents = findDelayedByFrameNo(element.FRN);
            }
        }
    });
}


/*----------- HELPER -----------*/
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
    if (typeof (array.sorted) != 'undefined')
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

/**
 * Sorts <array> according to property
 * @param {Array} array to be sorted
 * @param {String} property according to which be sorted
 */
function bubbleSortArrayByProperty(array, property) {
    var swapped;
    if (typeof (array.sorted) != 'undefined')
        array.sorted = true;

    do {
        swapped = false;
        for (var i = 0; i < array.length - 1; i++) {
            if (array[i][property] > array[i + 1][property]) {
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