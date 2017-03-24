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
const DISTRIBUTION = 'NORM';
const VIDEO_BUFFER_PLAY_THRESHOLD_MIN = 1000; //in ms
const VIDEO_BUFFER_PLAY_THRESHOLD_MAX = 4000; //in ms
const VIDEO_BUFFER_PLAY_THRESHOLD_STEP = 500; //in ms
const META_BUFFER_PLAY_THRESHOLD_MIN = 1000; //in ms
const META_BUFFER_PLAY_THRESHOLD_MAX = 4000; //in ms
const META_BUFFER_PLAY_THRESHOLD_STEP = 500; //in ms
const TEST_DURATION = 40000; //in ms

//set at check_consistency()
var finalFrame = 0, finalTimeStamp = 0, actualFrames = 0, firstFrame = -1, firstTimestamp = 0;
//set at check_delays()
var maxObservedDelay = 0, minObservedDelay = 99999;

//other vars
var proj = [], dela = [], dela_ordered = [], video_ordered = [];

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



var test_buffer = [];
for (var mbuff_thres = META_BUFFER_PLAY_THRESHOLD_MIN; mbuff_thres <= META_BUFFER_PLAY_THRESHOLD_MAX; mbuff_thres += META_BUFFER_PLAY_THRESHOLD_STEP) {
    for (var vbuff_thres = VIDEO_BUFFER_PLAY_THRESHOLD_MIN; vbuff_thres <= VIDEO_BUFFER_PLAY_THRESHOLD_MAX; vbuff_thres += VIDEO_BUFFER_PLAY_THRESHOLD_STEP) {
        //for resetting queues
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
            if (i_a < dela_ordered.length - 1) {
                item.TnextDiff = parseInt(dela_ordered[i_a + 1][28][1] - item.T_display);
                item.FRNnext = parseInt(dela_ordered[i_a + 1][4][1]);
            } else {
                item.TnextDiff = -1;
                item.FRNnext = -1;
            }
            dela_list.push(item);
        }

        var dela_Tarr_ordered = dela_list.slice(0);
        bubbleSortArrayByProperty(dela_Tarr_ordered, 'T_arrival');




        write(RESULTS_FILE + '_FIXED_'+DISTRIBUTION+'_Mbuff_' + mbuff_thres + '_Vbuff' + vbuff_thres + '.txt', 'Time \t vbuffer \t mbuffer (c) \t mbuffer (f)');

        T_zero = video_ordered[0].T;    //first vframe timestamp
        T_start = 0;    //timestamp of vframe when video starts playback
        T_end = T_zero + TEST_DURATION;
        var Vbuff = [];
        var current_vframe = video_ordered[0];
        var current_vbuff_status = 'NEW';

        var Mbuff = [];
        var Mbuff_f_size = 0;
        var Mbuff_size = 0;
        var Mbuff_changed = false;
        var m_index = 0;
        var current_mframe = dela_Tarr_ordered[m_index];
        var current_mbuff_status = 'NEW';

        for (var v_i = 0; v_i < video_ordered.length; v_i++) {   //iterate vframes

            if (TEST_DURATION < (current_vframe.T -video_ordered[0].T)) {     //check if exceeded test duration
                break;
            }
            //first do the vframes
            current_vframe = video_ordered[v_i];    //select current vframe
            Vbuff.push(video_ordered[v_i]);     //push current vframe in Vbuffer
            if (current_vbuff_status == 'NEW') {
                if (vbuff_thres <= (Vbuff[Vbuff.length - 1].T - Vbuff[0].T)) {   //check if we are on playback levels
                    T_start = Vbuff[Vbuff.length - 1].T;
                    Vbuff.shift();
                    current_vbuff_status = 'PLAYING';
                    console.log("VIDEO PLAYING")
                }
            } else if (current_vbuff_status == 'PLAYING') {
                if (Vbuff.length == 0) {
                    current_vbuff_status = 'BUFFERING';
                    console.log("VIDEO BUFFERING")
                } else {
                    Vbuff.shift();                  //if we are playing and frame is due, remove from buffer
                }
            } else if (current_vbuff_status == 'BUFFERING') {
                if (Vbuff.length > 0) {
                    current_vbuff_status = 'PLAYING';
                    console.log("VIDEO PLAYING")
                }
            }


            //then the metaframes
            current_mframe = dela_Tarr_ordered[m_index];    //select current mframe
            while (current_mframe.T_arrival <= current_vframe.T) {    //push current mframe in MBuffer
                Mbuff.push(current_mframe);
                m_index++;
                current_mframe = dela_Tarr_ordered[m_index];
                Mbuff_changed = true;
            }

            if (Mbuff_changed && Mbuff.length > 0) {
                bubbleSortArrayByProperty(Mbuff, 'FRN');
                //calculate fragmented buffer size
                Mbuff_f_size = (Mbuff[Mbuff.length - 1].T_display - Mbuff[0].T_display);
                //calculate non-fragmented buffer size
                if (Mbuff.length > 1) {
                    var d_index = 0;
                    for (var i_c = 0; i_c < dela_list.length; i_c++) {
                        if (dela_list[i_c].FRN == Mbuff[0].FRN) {
                            d_index = i_c;
                            break;
                        }
                    }

                    var b_index = 0;
                    while ((b_index < Mbuff.length) && dela_list[d_index].FRN == Mbuff[b_index].FRN) {
                        Mbuff_size = (Mbuff[b_index].T_display - Mbuff[0].T_display);
                        b_index++;
                        d_index++;
                    }
                }
            }
            Mbuff_changed = false;

            if (current_mbuff_status == 'NEW') {
                if (mbuff_thres <= Mbuff_size) {   //check if we are on playback levels
                    if (Mbuff[0].T_display < Vbuff[0].T) {
                        Mbuff.shift();
                        Mbuff_changed = true;
                    }
                    current_mbuff_status = 'PLAYING';
                    console.log("META PLAYING")
                }
            } else if (current_mbuff_status == 'PLAYING') {
                if (Mbuff.length == 0) {
                    current_mbuff_status = 'BUFFERING';
                    console.log("META BUFFERING")
                } else {
                    if (Mbuff[0].T_display < Vbuff[0].T) {
                        Mbuff.shift();
                        Mbuff_changed = true;
                    }
                }
            } else if (current_mbuff_status == 'BUFFERING') {
                if (Mbuff.length > 0) {
                    current_mbuff_status = 'PLAYING';
                    console.log("META PLAYING")
                }
            }

            append(RESULTS_FILE + '_FIXED_'+DISTRIBUTION+'_Mbuff_' + mbuff_thres + '_Vbuff' + vbuff_thres + '.txt', '\n' + (current_vframe.T - T_zero) + '\t' + (Vbuff[Vbuff.length - 1].T - Vbuff[0].T) + '\t' + Mbuff_size + '\t' + Mbuff_f_size);

        }

        console.log('test done');
    }

}

console.log('ALL tests done');



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
        video_ordered.push({ TYPE: 'VID', T: i, T_display: i, T_arrival: i, FRN: frn_t });
        frn_t++;
    }
    for (var i = 0; i < video_ordered.length; i++) {
        var item = video_ordered[i];
        if (i < video_ordered.length - 1) {
            item.TnextDiff = parseInt(video_ordered[i + 1].T_display - item.T_display);
            item.FRNnext = parseInt(video_ordered[i + 1].FRN);
        } else {
            item.TnextDiff = -1;
            item.FRNnext = -1;
        }
    }
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