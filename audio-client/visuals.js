//options
var WITH_GRADIENT = false;
var WITH_SKELETON = true;
var WITH_OVERLAY = true;

//vars
var overlay_canv, over_canv_ctx;
var canvasCtx;
var yLineMax, yLineMin;
var new_viz = true;
var counter = 0;
var Rstack;
var Lstack;
var init_viz = true;

var lastDrawnDel = [[0, 0], [0, 0]];
var lastDrawnProj = [[0, 0], [0, 0]];
var lastSkelDel =[];
var lastSkelProj =[];

function canvasInit() {
	canvas = document.querySelector('#c');
	canvas.width = video.width;
	canvas.height = video.height;
	canvasCtx = canvas.getContext('2d');
	if(WITH_OVERLAY){
		overlay_canv = document.querySelector('#canv');
		overlay_canv.width = video.width;
		overlay_canv.height = video.height;
		over_canv_ctx = overlay_canv.getContext('2d');
		over_canv_ctx.fillStyle="rgba(100,100,100,0.5)";
		over_canv_ctx.fillRect(0,0,overlay_canv.width,overlay_canv.height);
	}
}

function drawViz(e, skel_type) {
	if (typeof e.coordsProj === 'undefined') {
		e = e.data;
	}
	var projC = e.coordsProj;


	if (WITH_GRADIENT) {

		var gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);

		gradient.addColorStop(0, "black");
		gradient.addColorStop(map(projC[0][0], 0, 320, 0, 1), "blue");

		gradient.addColorStop(1, "white");
		canvasCtx.fillStyle = gradient;
		//canvasCtx.fillRect(10,10,200,100);


		//canvasCtx.fillStyle = 'rgb(0,255,255)';
		//canvasCtx.fillRect(0,yLineMax,canvas.width,3);
		canvasCtx.fillRect(0, 0, canvas.width, canvas.height);



	}



	if (new_viz) {
		if (counter < 10) counter++;
		do_viz(projC, skel_type);
		if (!is_playing && init_viz) { //we received the first skeleton coords
			initVizEnv(projC);
		}


		//return;
	}

	if (!is_playing && init_viz) { //we received the first skeleton coords
		initVizEnv(projC);
	}

	if(WITH_SKELETON){
		if(!new_viz){
			drawSkeleton(projC, 'rgb(255,0,0)');
		}else{
			if(skel_type === 'del'){
				lastSkelDel = projC.slice();
			}else if(skel_type ==='proj'){
				lastSkelProj = projC.slice();
			}
				drawSkeleton(lastSkelDel, 'rgb(255,0,0)');
				drawSkeleton(lastSkelProj,'rgb(255,255,255)');
		}
	}

/*
	canvasCtx.fillStyle = 'rgb(50,255,0)';
	canvasCtx.fillRect(0, yLineMax, canvas.width, 3);
	canvasCtx.fillRect(0, yLineMin, canvas.width, 3);
*/
}

function initVizEnv(skel) {
	if (typeof skel[3] === "undefined") {
		console.log("[TODO] check this")
		console.log(skel)
		return;
	}
	var head = skel[3][1];
	yLineMax = head > 0 ? 2 * head : 0;
	var kneeAvg = (skel[13][1] + skel[17][1]) / 2;
	yLineMin = 2 * Math.round(kneeAvg - (yLineMax + kneeAvg) / 9);
	init_viz = false;

}

function do_viz(projC, skel_type) {
	//system.addParticle();
	var slot = -1;	//0 -> LHand (index 7) 1 -> RHand (index 11)

	projC.forEach(function (item, index, array) {
		if (index == 7) {
			canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
			slot = 0;
		} else if (index == 11) {
			slot = 1;
		} else {
			return;
		}

		//var radius = map(projC[index][1], yLineMin, yLineMax, 1, 25);

		if (skel_type === 'proj') {
			lastDrawnProj[slot][0] = 2 * item[0];
			lastDrawnProj[slot][1] = 2 * item[1];
		} else if (skel_type === 'del') {
			lastDrawnDel[slot][0] = 2 * item[0];
			lastDrawnDel[slot][1] = 2 * item[1];
		} else {
			console.log("[ERROR] drawing error");
			return;
		}

		drawArc(lastDrawnProj[slot], 'rgb(255,255,255)');
		drawArc(lastDrawnDel[slot], 'rgb(255,0,0)');
	});

}

function drawSkeleton(skelArray_in, colour){
	skelArray_in.forEach(function (item, index, array) {
		canvasCtx.beginPath();
		canvasCtx.fillStyle = colour;
		canvasCtx.arc(2 * item[0], 2 * item[1], 5, (Math.PI / 180) * 0, (Math.PI / 180) * 360, false);
		canvasCtx.fill();
		canvasCtx.closePath();
	});
}

function drawArc(xy, colour) {
	canvasCtx.beginPath();
	canvasCtx.fillStyle = colour;
	canvasCtx.arc(xy[0], xy[1], 10, (Math.PI / 180) * 0, (Math.PI / 180) * 360, false);
	canvasCtx.fill();
	canvasCtx.closePath();
}