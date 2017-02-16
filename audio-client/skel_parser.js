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

//Sample Entries
/*

TYPE:ORIG T:23029 SEG:24 SKN:487 FRN:535516 A:0.0969022,0.22044,2.40654 0:0.106982,0.356236,2.50521 1:0.108404,0.421014,2.56649 2:0.107727,0.8043,2.57521 3:0.0953725,1.01334,2.51539 4:-0.0745403,0.705122,2.59469 5:-0.22259,0.472714,2.48423 6:-0.372995,0.333027,2.36639 7:-0.448516,0.290988,2.30301 8:0.295922,0.700637,2.58509 9:0.501516,0.643709,2.40576 10:0.645799,0.670128,2.21773 11:0.745939,0.701494,2.10324 12:0.0236109,0.275551,2.48644 13:-0.024848,-0.229688,2.53074 14:-0.0667875,-0.652273,2.54789 15:-0.0906295,-0.727815,2.50569 16:0.189682,0.272605,2.49268 17:0.22775,-0.251825,2.52337 18:0.26753,-0.638935,2.56685 19:0.280088,-0.738597,2.5211

TYPE:PROJ T:23029 SEG:24 SKN:487 FRN:535516 A:172,94,19248 0:172,79,20040 1:172,73,20528 2:172,31,20600 3:171,5,20120 4:152,42,20752 5:134,66,19872 6:115,80,18928 7:104,84,18424 8:193,43,20680 9:220,44,19240 10:243,34,17736 11:261,25,16824 12:163,88,19888 13:157,146,20240 14:153,193,20376 15:150,203,20040 16:182,89,19936 17:186,149,20184 18:190,191,20528 19:192,204,20168

TYPE:DELA T:23136.3 SEG:22 SKN:446 FRN:535468 A:171,88,19184 0:172,79,20112 1:172,73,20600 2:172,31,20712 3:169,6,20128 4:150,42,20632 5:124,42,19112 6:100,33,17736 7:90,27,17144 8:193,43,20720 9:220,39,19200 10:242,26,17648 11:256,18,16928 12:162,88,19936 13:158,145,20224 14:153,191,20496 15:150,202,20096 16:182,89,20016 17:186,148,20200 18:189,195,20520 19:193,206,20304 D:1706.32

*/

const CHECK_QEUE_INTERVAL = 30;	//in ms

var last_timestamp = 0; //global variable holding last skeleton set timestamp
var last_A_dist; //global variable holding last skeleton set center coords
var last_A_proj; //global variable holding last skeleton set screen projection center coords
var intervalID, startTime;
var skelOutProjIndex = 0;
var skelOutDelIndex = 0;

var skelsDist = [];
var skelsProj = [];
var skelsDel = [];
var frames = [];

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

		if(type==="ORIG"){
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
		}else if(type ==="DELA"){
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
		}else if(type === "PROJ"){
			Skel.Aproj = A_in.map(function(elem){
				return(parseInt(elem));
			});
			skel_in.forEach(function(item, index, array) {
				Skel.coordsProj[index] = item.split(':')[1].split(',').map(function(elem){
					return(parseInt(elem));
				});
			});
		}else{
			console.log("[WARNING] non-recognized skeleton format - aborting");
			return null;
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
		intervalID = setInterval(check_qeue, CHECK_QEUE_INTERVAL);
		startTime = performance.now();
	}else if (type=='kill'){
		kill_skels();
	}
}

function check_qeue() {

	var time = performance.now() - startTime;

	if ((typeof skeletons.skeletons === 'undefined') || (skeletons.skeletons.length < 1)) {
		/*	//We do not want to stop anymore when the sklls are over
		send_message('now', 'stop');
		clearInterval(intervalID);
		return;
		*/
		return;
	}

	if (time < skeletons.skeletons[0].timestamp) return;

	if(skeletons.skeletons.length <= skelOutProjIndex) return;

	if (time >= skeletons.skeletons[skelOutProjIndex].timestamp) {
		send_message(skeletons.skeletons[skelOutProjIndex], 'skel_proj');
		skelOutProjIndex++;
	}

	//TODO by checking frames[0] only, we do not show out-of-order
	var i =	skelsDel.findIndex(function (element){
		return element.frame_num == frames[0];
	});
	if(i>-1 && skelsDel[i].timestamp <= time){
		frames.shift();
		send_message(skelsDel.splice(i,1)[0], 'skel_del');
		skelOutDelIndex++;
	}


	/*if (time >= skeletons.skeletons[skelOutDelIndex].timestamp) {
		send_message(skeletons.skeletons[skelOutDelIndex], 'skel_del');
		skelOutDelIndex++;
	}*/

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

	if(type === 'DELA'){
		skelsDel.push(Skel_in);
	}else if(type === 'PROJ'){
		skelsProj.push(Skel_in);
		frames.push(Skel_in.frame_num);
	}else{	//type ORIG
		skelsDist.push(Skel_in);
	}
	
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