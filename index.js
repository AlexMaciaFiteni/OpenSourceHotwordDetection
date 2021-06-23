const Models = require('snowboy').Models;
const Detector = require('snowboy').Detector;

const record = require('node-record-lpcm16');
const fs = require('fs');
const WavFileWriter = require('wav').FileWriter;
const VAD = require('node-vad');

const vad = new VAD(VAD.Mode.NORMAL);

// Constants
const micThreshold = 0;
const sampleRate = 8000;
const resultFilePath = 'res.wav';

// States
let currentState = 0;
let stream;

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

  stream.end();
  stream = null;
});

detector.on('sound', function (buffer) {
  if(currentState < 1) return; // Only 1 or 2
  currentState = 2;
  
  console.log('sound');
  vad.processAudio(buffer, sampleRate).then(res => {
        switch (res) {
            case VAD.Event.ERROR:
                console.log(" > Sound Vad: ERROR");
                break;
            case VAD.Event.NOISE:
                console.log(" > Sound Vad: NOISE");
                break;
            case VAD.Event.SILENCE:
                console.log(" > Sound Vad: SILENCE");
                break;
            case VAD.Event.VOICE:
                console.log(" > Sound Vad: VOICE");
                break;
        }
    }).catch(); //console.log('Error on VAD apply'));

  stream.write(buffer);
});

detector.on('error', function () {
  console.log('error');
});

detector.on('hotword', function (index, hotword, buffer) {
  if(currentState != 0) return;
  currentState = 1;
  
  console.log(buffer);
  console.log('hotword', index, hotword);

  stream = new WavFileWriter(resultFilePath, {
    sampleRate: sampleRate,
    bitDepth: 16,
    channels: 2
  });
});

const mic = record.record({
  threshold: micThreshold,
  verbose: true
}).stream().pipe(detector);
