// create web audio api context
var audioCtx = new(window.AudioContext || window.webkitAudioContext)();

// create Oscillator and gain node
var oscillator = audioCtx.createOscillator();
var gainNode = audioCtx.createGain();
var reverb = audioCtx.createConvolver();
var modulator = audioCtx.createOscillator(); //Modulator
var modulatorGain = audioCtx.createGain();

var reverbBuffer, soundSource;
var distV = 50;

// create initial theremin frequency and volumn values

var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;

var maxFreq = 6000;
var maxVol = 0.0005;

var initialFreq = 3000;
var initialVol = 0.00005;

// set options for the oscillator
oscillator.type = 'sine'; //also supports sine, sawtooth, triangle and custom
oscillator.frequency.value = initialFreq; // value in hertz
oscillator.detune.value = 0; // value in cents
gainNode.gain.value = initialVol;
//oscillator.start(0);		//we do not want it to start with no data

oscillator.detune.value = -5; // value in cents

modulationFrequency = 10;
modFreqMax = 50;
modDepthMax = 200;
modulator.frequency.value = 10;
modulatorGain.gain.value = 50;



//custom
var is_playing = false;

//panning
var panNode = audioCtx.createStereoPanner();


// connect oscillator to gain node to speakers
oscillator.connect(panNode);
panNode.connect(gainNode);


var yMin, yMax; //yMax = headY , yMin = kneeY + |headY - kneeY|/9

//Entry point
function do_the_audio(e) {

	if(DISABLE_AUDIO)
		return;
	
	var skel = e;

	if (!is_playing) {
		if (withReverb) {
			gainNode.gain.value = initialVol * 2;
		} else if (withModulation) {
			modulator.connect(modulatorGain);
			modulatorGain.connect(oscillator.frequency);
			oscillator.connect(gainNode);
			gainNode.connect(panNode);
			panNode.connect(audioCtx.destination);
			modulator.start(0);
		} else {
			gainNode.connect(panNode);
			panNode.connect(audioCtx.destination);
		}


		initAudioEnv(skel);
		oscillator.start(0);
		//oscillator2.start(0);
		is_playing = true;
	}

	oscillator.frequency.value = map(skel.coordsDist[11][1], yMin, yMax, 0, maxFreq);

	panNode.pan.value = map(skel.Aproj[0], 0, 320, -1, 1);

	if (withModulation) {
		modulator.frequency.value = map(skel.coordsDist[7][1], yMin, yMax, 0, modFreqMax);
	}

}

function initAudioEnv(skel) {
	yMax = skel.coordsDist[3][1];
	var kneeAvg = (skel.coordsDist[13][1] + skel.coordsDist[17][1]) / 2;
	yMin = kneeAvg + (skel.coordsDist[3][1] - kneeAvg) / 9;
}

function initReverb(resp) {
	var audioData = resp.target.response;
	audioCtx.decodeAudioData(audioData, function(buffer) {
		reverbBuffer = buffer;
		soundSource = audioCtx.createBufferSource();
		soundSource.buffer = reverbBuffer;
		reverb.buffer = reverbBuffer;
		gainNode.connect(reverb);
		reverb.connect(audioCtx.destination);
	}, function(e) {
		"Error with decoding audio data" + e.err
	});

}

function kill_audio() {
	if(!DISABLE_AUDIO)
		oscillator.stop();
}