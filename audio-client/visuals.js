var canvasCtx;
var yLineMax, yLineMin;
var new_viz = true;
var with_gradient = true;
var counter = 0;
var Rstack;
var Lstack;

function canvasInit() {
	setup();
	canvas = document.querySelector('.canvas');
	canvas.width = video.width;
	canvas.height = video.height;
	canvasCtx = canvas.getContext('2d');
	system = new ParticleSystem(createVector(width / 2, 50));
}

function setup() {
	cp5js = createCanvas(640, 480);
	console.log(cp5js);
	cp5js.id = 'c5';
	return;
}

function drawViz(e) {
	var projC = e.coordsProj;
	canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
	clear();

	if (with_gradient) {

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
		do_viz(projC);
		if (!is_playing) { //we received the first skeleton coords
			initVizEnv(projC);
		}


		return;
	}

	if (!is_playing) { //we received the first skeleton coords
		initVizEnv(projC);
	}

	projC.forEach(function(item, index, array) {
		canvasCtx.beginPath();
		canvasCtx.fillStyle = 'rgb(255,0,0)';
		canvasCtx.arc(2 * item[0], 2 * item[1], 5, (Math.PI / 180) * 0, (Math.PI / 180) * 360, false);
		canvasCtx.fill();
		canvasCtx.closePath();
	});

	canvasCtx.fillStyle = 'rgb(50,255,0)';
	canvasCtx.fillRect(0, yLineMax, canvas.width, 3);
	canvasCtx.fillRect(0, yLineMin, canvas.width, 3);

}

function initVizEnv(skel) {
	var head = skel[3][1];
	yLineMax = head > 0 ? 2 * head : 0;
	var kneeAvg = (skel[13][1] + skel[17][1]) / 2;
	yLineMin = 2 * Math.round(kneeAvg - (yLineMax + kneeAvg) / 9);

}

function do_viz(projC) {
	//system.addParticle();

	projC.forEach(function(item, index, array) {
		if (index == 7) {
			colour = 'rgba(255,0,0,1)';
			system.addParticle(2 * item[0], 2 * item[1], index);
		} else if (index == 11) {
			colour = 'rgba(0,255,0,1)';
			system.addParticle(2 * item[0], 2 * item[1], index);
		} else {
			return;
		}

		radius = map(projC[index][1], yLineMin, yLineMax, 1, 25);

		canvasCtx.beginPath();
		canvasCtx.fillStyle = 'rgb(255,255,255)';
		canvasCtx.arc(2 * item[0], 2 * item[1], 10, (Math.PI / 180) * 0, (Math.PI / 180) * 360, false);
		canvasCtx.fill();
		canvasCtx.closePath();



	});
	system.run();
}

var Particle = function(position, x, y, number) {
	this.acceleration = createVector(0, 0.05);
	this.velocity = createVector(random(-1, 1), random(-1, 0));
	if (typeof x === 'undefined') {
		this.position = position.copy();
		this.number = -1;
	} else {
		this.position = createVector(x, y);
		this.number = number;
	}
	this.lifespan = 120.0;
};

Particle.prototype.run = function() {
	this.update();
	this.display();
};

// Method to update position
Particle.prototype.update = function() {
	this.velocity.add(this.acceleration);
	this.position.add(this.velocity);
	this.lifespan -= 2;
};

// Method to display
Particle.prototype.display = function() {
	stroke(200, this.lifespan * 2);
	strokeWeight(2);
	if (this.number > 0) {
		if (this.number == 7) {
			fill(255, 0, 0, this.lifespan * 2);
		} else if (this.number == 11) {
			fill(0, 255, 0, this.lifespan * 2);
		}
	} else {
		fill(127, this.lifespan * 2);
	}
	ellipse(this.position.x, this.position.y, 12, 12);
};

// Is the particle still useful?
Particle.prototype.isDead = function() {
	if (this.lifespan < 0) {
		return true;
	} else {
		return false;
	}
};

var ParticleSystem = function(position) {
	//this.origin = position.copy();
	this.particles = [];
};

ParticleSystem.prototype.addParticle = function(x, y, number) {
	this.particles.push(new Particle(this.origin, x, y, number));
};

ParticleSystem.prototype.run = function() {
	for (var i = this.particles.length - 1; i >= 0; i--) {
		var p = this.particles[i];
		p.run();
		if (p.isDead()) {
			this.particles.splice(i, 1);
		}
	}
};