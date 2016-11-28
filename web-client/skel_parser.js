//Joints Reference
/*
    NUI_SKELETON_POSITION_HIP_CENTER : 0,
    NUI_SKELETON_POSITION_SPINE : 1,
    NUI_SKELETON_POSITION_SHOULDER_CENTER : 2,
    NUI_SKELETON_POSITION_HEAD : 3,
    NUI_SKELETON_POSITION_SHOULDER_LEFT : 4,
    NUI_SKELETON_POSITION_ELBOW_LEFT : 5,
    NUI_SKELETON_POSITION_WRIST_LEFT : 6,
    NUI_SKELETON_POSITION_HAND_LEFT : 7,
    NUI_SKELETON_POSITION_SHOULDER_RIGHT : 8,
    NUI_SKELETON_POSITION_ELBOW_RIGHT : 9,
    NUI_SKELETON_POSITION_WRIST_RIGHT : 10,
    NUI_SKELETON_POSITION_HAND_RIGHT : 11,
    NUI_SKELETON_POSITION_HIP_LEFT : 12,
    NUI_SKELETON_POSITION_KNEE_LEFT : 13,
    NUI_SKELETON_POSITION_ANKLE_LEFT : 14,
    NUI_SKELETON_POSITION_FOOT_LEFT : 15,
    NUI_SKELETON_POSITION_HIP_RIGHT : 16,
    NUI_SKELETON_POSITION_KNEE_RIGHT : 17,
    NUI_SKELETON_POSITION_ANKLE_RIGHT : 18,
    NUI_SKELETON_POSITION_FOOT_RIGHT : 19
*/

//Sample Example
/*

T:4542 A:0.0103097,0.092336,2.32413 0:0.0112536,0.2979,2.40354 1:0.0213734,0.36907,2.44919 2:0.0257358,0.752418,2.43409 3:-0.00814651,0.94194,2.32035 4:-0.140039,0.6729,2.50291 5:-0.191736,0.394673,2.5128 6:-0.232179,0.177953,2.41051 7:-0.240909,0.078246,2.36053 8:0.193445,0.661755,2.44184 9:0.296573,0.396263,2.48413 10:0.339128,0.164406,2.35001 11:0.336094,0.0699649,2.31636 12:-0.0666484,0.224374,2.40671 13:-0.143956,-0.329041,2.35673 14:-0.180217,-0.736658,2.39007 15:-0.207889,-0.801028,2.34326 16:0.0850265,0.221579,2.3868 17:0.122709,-0.350963,2.44201 18:0.118881,-0.760212,2.45635 19:0.133839,-0.810782,2.37594
T:4542 A:161,109,18592 0:161,85,19224 1:162,77,19592 2:163,32,19472 3:159,4,18560 4:144,43,20016 5:138,75,20096 6:132,99,19280 7:131,111,18880 8:183,43,19528 9:194,74,19872 10:201,100,18800 11:201,111,18528 12:152,93,19248 13:143,160,18848 14:138,208,19120 15:135,218,18744 16:170,93,19088 17:174,161,19536 18:174,208,19648 19:176,217,19000

*/



var last_timestamp = 0; //global variable holding last skeleton set timestamp
var last_A_dist; //global variable holding last skeleton set center coords
var last_A_proj; //global variable holding last skeleton set screen projection center coords
var intervalID, startTime;

//Skeleton object
var Skeleton = function() {
	this.timestamp = 0; //we also use it as ID
	this.Adist = 0; //Centre Coord
	this.Aproj = 0; //Projected Centre Coord
	this.coordsDist = []; //Joint Coords
	this.coordsProj = []; //Projected Joint Coords
	this.inSync = false; //The Projected Coords are in sync
};

//Push coords to Skeleton object
//NOTE:	We do not store the Skeletons, as soon as the pair is parsed
//		and we add the cue, it is lost
Skeleton.prototype.push = function(skel_in, isProjected, A) {

	if (isProjected == true) {
		this.Aproj = A.map(function(elem){
			return(parseInt(elem));
		});
		skel_in.forEach(function(item, index, array) {
			skeleton.coordsProj[index] = item.split(':')[1].split(',').map(function(elem){
			return(parseInt(elem));
		});
		});
	} else {
		this.Adist = A.map(function(elem){
			return(parseFloat(elem));
		});
		skel_in.forEach(function(item, index, array) {
			skeleton.coordsDist[index] = item.split(':')[1].split(',').map(function(elem){
			return(parseFloat(elem));
		});
		});
	}

};


//Current Skeleton
var skeleton = new Skeleton();
//unused Skeletons array
var skeletons = [];

//Entry point - since this is a worker
onmessage = function(e) {
	var type = e.data.type;
	var data = e.data.data;

	if (type == 'coords') {
		parse_skeleton(data);
	} else if (type == 'start') {
		intervalID = setInterval(check_qeue, 10);
		startTime = performance.now();
	}
}

function check_qeue() {

	var time = performance.now() - startTime;

	if ((typeof skeletons[0] === 'undefined') || (skeletons.length == 1)) {
		console.log('stopin');
		send_message('now', 'stop');
		clearInterval(intervalID);
		return;
	}

	if (time < skeletons[0].timestamp) return;

	if (time >= skeletons[0].timestamp && time < skeletons[1].timestamp) {
		send_message(skeletons.shift());
	}
}

function parse_skeleton(skel_set) {

	var curr_skel = skel_set.split(' ');
	var curr_time = parseInt(curr_skel.shift().split(':')[1]);
	var curr_A = curr_skel.shift().split(':')[1].split(',');

	if (skeleton.timestamp == curr_time) {
		skeleton.push(curr_skel, true, curr_A);
		skeleton.inSync = true;
	} else {
		skeleton.push(curr_skel, false, curr_A);
		skeleton.timestamp = curr_time;
		skeleton.inSync = false;
	}

	console.log(skeleton);

	if (skeleton.inSync) {
		//skeleton_to_cue();
		skeletons.push(Object.assign({}, skeleton));
		skeletons[skeletons.length - 1].coordsDist = skeleton.coordsDist.slice();
		skeletons[skeletons.length - 1].coordsProj = skeleton.coordsProj.slice();
		//		skeletons[skeletons.length-1].AProj = skeleton.AProj.slice();
		//		skeletons[skeletons.length-1].ADist = skeleton.ADist.slice();
	}
}

function skeleton_to_cue() {
	//textTrack.addCue(new TextTrackCue(skeleton.timestamp, skeleton.timestamp+10,skeleton.timestamp));
	tms = parseInt(skeleton.timestamp) / 1000; //cues are in sec
	textTrack.addCue(new VTTCue(tms, tms + 0.010, skeleton.timestamp));
}

function send_message(msg, _type) {
	if (typeof _type === 'undefined') {
		postMessage(msg);
	} else {
		postMessage({
			type: _type,
			data: msg
		});
	}

}