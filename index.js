const Models = require('snowboy').Models;
const Detector = require('snowboy').Detector;
const record = require('node-record-lpcm16');

// States
let currentState = 0;

const models = new Models();

models.add({
  file: 'models/snowboy.umdl',
  sensitivity: '0.5',
  hotwords : 'snowboy'
});

const detector = new Detector({
  resource: "resources/common.res",
  models: models,
  audioGain: 2.0,
  applyFrontend: true
});

// Events
detector.on('silence', function () {
  if(currentState == 1) console.log('Silence but waiting order...');
  if(currentState != 2) return;
  currentState = 0;
  
  console.log('Silence');
});

detector.on('sound', function (buffer) {
  if(currentState < 1) return; // Only 1 or 2
  currentState = 2;
  
  // <buffer> contains the last chunk of the audio that triggers the "sound"
  // event. It could be written to a wav stream.
  console.log('sound');
});

detector.on('error', function () {
  console.log('error');
});

detector.on('hotword', function (index, hotword, buffer) {
  if(currentState != 0) return;
  currentState = 1;
  
  // <buffer> contains the last chunk of the audio that triggers the "hotword"
  // event. It could be written to a wav stream. You will have to use it
  // together with the <buffer> in the "sound" event if you want to get audio
  // data after the hotword.
  console.log(buffer);
  console.log('hotword', index, hotword);
});

const mic = record.record({
  threshold: 0.5,
  verbose: true
}).stream().pipe(detector);
