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

T:12049 SEG:13 SKN:185 A:-0.0157103,0.0938176,2.31539 0:-0.0115422,0.293589,2.38151 1:-0.0103904,0.361336,2.44192 2:-0.00976931,0.748472,2.43812 3:-0.0231551,0.914085,2.3604 4:-0.177932,0.6536,2.45986 5:-0.240648,0.380506,2.4562 6:-0.262034,0.115684,2.34339 7:-0.24902,0.0389183,2.33563 8:0.167433,0.660565,2.47483 9:0.226306,0.392471,2.4786 10:0.260953,0.180623,2.38429 11:0.262182,0.0833886,2.32662 12:-0.0861892,0.217386,2.36939 13:-0.124604,-0.348835,2.42005 14:-0.144341,-0.748849,2.42879 15:-0.20209,-0.80404,2.34863 16:0.067855,0.216833,2.36917 17:0.0993317,-0.356147,2.42115 18:0.122959,-0.759519,2.45527 19:0.136243,-0.810369,2.38052
T:12016 SEG:13 SKN:185 A:158,109,18528 0:158,85,19048 1:159,78,19536 2:159,32,19504 3:157,10,18888 4:139,44,19720 5:132,76,19712 6:129,104,18888 7:130,114,18704 8:179,44,19736 9:186,75,19784 10:191,99,19016 11:192,110,18576 12:149,94,18976 13:145,161,19392 14:143,208,19440 15:135,218,18784 16:168,94,18936 17:172,162,19360 18:174,208,19632 19:176,217,19040 D:2075.34

*/



var last_timestamp = 0; //global variable holding last skeleton set timestamp
var last_A_dist; //global variable holding last skeleton set center coords
var last_A_proj; //global variable holding last skeleton set screen projection center coords
var intervalID, startTime;

//Skeleton object
var Skeleton = function() {
	this.timestamp = 0; //we also use it as ID	[TODO: switch id to frame_num]
	this.Adist = 0; //Centre Coord
	this.Aproj = 0; //Projected Centre Coord
	this.coordsDist = []; //Joint Coords
	this.coordsProj = []; //Projected Joint Coords
	this.coordsProjDel = []; //Projected Joint Coords
	this.inSync = false; //The Projected Coords are in sync
	this.delay = -1;	//Difference between projected and distance coordinates
	this.seg_num = -1;	//respective seg num
	this.sk_num = -1; //respective skel num (incremental)
	this.frame_num = -1; //respective (skel) frame num (by firmware)
};

var Skeletons = function(){
	this.len = 0;
	this.synced = -1;
	this.maxDelay = -1;
	this.skeletons = [];
}

//TODO this
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

//Push coords to Skeleton object
Skeleton.prototype.create = function(skel_in, type, time_in, A_in, curr_seg, curr_skn, curr_frame) {

	var Skel = new Skeleton();

	switch(skel_in.length){
		//we have dist coords
		case 20:
			Skel.Adist = A_in.map(function(elem){
				return(parseFloat(elem));
			});
			skel_in.forEach(function(item, index, array) {
				var one, two, three;
				one = item.split(':')[1];
				two = one.split(',');
				three = two.map(function(elem){
					return(parseFloat(elem));
				});
				Skel.coordsDist[index] = three;
			});
			break;
		//we have projected coords
		case 21:
			Skel.Aproj = A_in.map(function(elem){
				return(parseInt(elem));
			});
			var tmp = skel_in.splice(20, 1)[0];
			Skel.delay = parseFloat(tmp.split(':')[1]);
			skel_in.forEach(function(item, index, array) {
				Skel.coordsProj[index] = item.split(':')[1].split(',').map(function(elem){
					return(parseInt(elem));
				});
			});
			break;
		//We do not know what is what
		default:
			console.log("[WARNING] non-recognized skeleton format - aborting");
			break;
	}
	Skel.timestamp = time_in;
	Skel.seg_num = curr_seg;
	Skel.sk_num = curr_skn
	Skel.frame_num = curr_frame;
	return Skel;

}

function pushDist(skel_in, index){
	skeletons.skeletons.splice(index, 0, new Skeleton());
	skeletons.skeletons[index].timestamp = skel_in.timestamp;
	skeletons.skeletons[index].Adist = skel_in.Adist;
	skeletons.skeletons[index].coordsDist = skel_in.coordsDist;
	skeletons.skeletons[index].frame_num = skel_in.frame_num;
	skeletons.skeletons[index].seg_num = skel_in.seg_num;
	skeletons.len++;
}

Skeletons.prototype.push = function(skel_in){
	
	//first skel
	if(skeletons.len==0){
		pushDist(skel_in, 0);	
		return true;
	}

	if(skel_in.delay == -1){		//we have a dist Skel
		for(var i = 0; i < skeletons.skeletons.length; i++){
			if(skel_in.timestamp > skeletons.skeletons[i].timestamp){
				if(i+1 == skeletons.skeletons.length){
					pushDist(skel_in, i+1);
					return true;
				}else if(skel_in.timestamp < skeletons.skeletons[i+1].timestamp){
					pushDist(skel_in, i);
					return true;
				}
			}
		}
		//TODO we should need the framecheck condition
		if(skel_in.frame_num != skeletons.skeletons[skeletons.skeletons.length-1].frame_num){
			console.log("[ERROR] Skeleton couldn't be pushed");
		}
	}else if(skel_in.delay > -1	){	//We have a projected skel
		for(var i = 0; i < skeletons.skeletons.length; i++){
			if(skeletons.skeletons[i].frame_num == skel_in.frame_num){
				skeletons.skeletons[i].coordsProj = skel_in.coordsProj;
				skeletons.skeletons[i].Aproj = skel_in.Aproj;
				skeletons.skeletons[i].inSync = true;
				skeletons.skeletons[i].delay = skel_in.delay;
				if(skeletons.maxDelay < skel_in.delay){
					skeletons.maxDelay = skel_in.delay;
					console.log("[EVENT] Max delay updated to "+skeletons.maxDelay);
				}
				if(!skeletons.skeletons[i].timestamp == skel_in.timestamp){
					console.log("[WARNING] check this "+(skel_in.timestamp-skeletons.skeletons[i].timestamp));
				}
				return true;
			}
		}
		console.log("[ERROR] Projected skeleton couldn't be pushed");
	}else{
		console.log("[ERROR] Skeleton couldn't be pushed - format unknown");
	}

	return false;
}

Skeletons.prototype.seek_position = function(skel_in){
	
}


//Current Skeleton
var skeleton = new Skeleton();
//unused Skeletons array
var skeletons = new Skeletons();

//Entry point - since this is a worker
onmessage = function(e) {
	var type = e.data.type;
	var data = e.data.data;

	if(type == 'coord_f'){	//we have the  contents of a skeleton file
		for(const skel of data){
			parse_skeleton(skel);	//TODO check out of time
		}
		//TODO kill non-synced skells
		send_message('end', 'update');	//signal end of skeleton parsing
	}else if (type == 'coord_s') {	//we have a skeleton set
		parse_skeleton(data);
	} else if (type == 'start') {
		intervalID = setInterval(check_qeue, 10);
		startTime = performance.now();
	}else if (type=='kill'){
		kill_skels();
	}
}

function check_qeue() {

	var time = performance.now() - startTime;

	if ((typeof skeletons.skeletons[0] === 'undefined') || (skeletons.skeletons.length < 1)) {
		/*	//We do not want to stop anymore when the sklls are over
		send_message('now', 'stop');
		clearInterval(intervalID);
		return;
		*/
		return;
	}

	if (time < skeletons.skeletons[0].timestamp) return;

	//TODO  if (time >= skeletons.skeletons[0].timestamp && skeletons.skeletons[0].inSync){}
	if (time >= skeletons.skeletons[0].timestamp) {
		send_message(skeletons.skeletons.shift());
	}
}

function parse_skeleton(skel_set) {

	var res = false;

	if(skel_set.length < 3){
		return;	//possible blank line
	}

	var curr_skel = skel_set.split(' ');
	
	if(!skel_set.startsWith("TYPE:")){
		console.log("[ERROR] couldn't parse skeleton; skipping set ");
		return;
	}

	var type = (curr_skel.shift().split(':')[1]).toString();
	var curr_time = parseInt(curr_skel.shift().split(':')[1]);
	var curr_seg = parseInt(curr_skel.shift().split(':')[1]);
	var curr_skn = parseInt(curr_skel.shift().split(':')[1]);
	var curr_frame = parseInt(curr_skel.shift().split(':')[1]);
	var curr_A = curr_skel.shift().split(':')[1].split(',');
	
	var Skel_in = new Skeleton();
	Skel_in = Skel_in.create(curr_skel, type, curr_time, curr_A, curr_seg, curr_skn, curr_frame);

	if(Skel_in.timestamp == 0 && Skel_in.delay == -1){
		console.log("[ERROR] Skeleton couldn't be parsed; skipping set ");
		return;
	}

	skeletons.push(Skel_in);

/*
	if (skeleton.timestamp == curr_time) {
		skeleton.push(curr_skel, true, curr_A);
		skeleton.inSync = true;
	} else {
		skeleton.push(curr_skel, false, curr_A);
		skeleton.timestamp = curr_time;
		skeleton.inSync = false;
	}

	if (skeleton.inSync) {
		//skeleton_to_cue();
		skeletons.push(Object.assign({}, skeleton));
		skeletons[skeletons.length - 1].coordsDist = skeleton.coordsDist.slice();
		skeletons[skeletons.length - 1].coordsProj = skeleton.coordsProj.slice();
		//		skeletons[skeletons.length-1].AProj = skeleton.AProj.slice();
		//		skeletons[skeletons.length-1].ADist = skeleton.ADist.slice();
	}
	*/
}

//TODO delete - we are not using cues anymore
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

function kill_skels(){
		console.log('stopin');
		send_message('now', 'stop');
		clearInterval(intervalID);
}