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

let bufferSize = 4096;

// States
let currentState = 0;
let stream = null;
let silenceStrikes = 0;
const maxSilenceStrikes = 4;

// Events
function OnHotword(buffer) {
  if(currentState != 0) return;
  currentState = 1;
  
  console.log('Hotword detected!');
  
  bufferSize = buffer.length;
  silenceStrikes = 0;

  stream = new WavFileWriter(resultFilePath, {
    sampleRate: sampleRate,
    bitDepth: 16,
    channels: 2
  });
}

function ClassifyBuffer(buffer) {
  vad.processAudio(buffer, sampleRate).then(res => {
    switch (res) {
        case VAD.Event.ERROR:
        case VAD.Event.SILENCE:
            OnSilence(buffer);
            break;
        case VAD.Event.NOISE:
        case VAD.Event.VOICE:
            OnSound(buffer);
            break;
    }
  }).catch();
  
  if(stream)
    stream.write(buffer);
}

function OnSound(buffer) {
  if(currentState < 1) return; // Only 1 or 2
  currentState = 2;
  
  silenceStrikes = 0;
  
  console.log('Sound');
}

function OnSilence(buffer) {
  if(currentState == 1) console.log('Silence but waiting order...');
  if(currentState != 2) return;
  
  console.log('Silence');
  
  silenceStrikes++;

  if(silenceStrikes >= maxSilenceStrikes)
  {
    currentState = 0;
    
    stream.end();
    stream = null;
  }
}

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

// Snowboy Events
detector.on('hotword', function (index, hotword, buffer)
  { OnHotword(buffer); });

detector.on('sound', function (buffer)
  { ClassifyBuffer(buffer); });

detector.on('silence', function ()
  { ClassifyBuffer(Buffer.alloc(bufferSize, 0)); });

detector.on('error', function () {
  console.log('error');
});

const mic = record.record({
  threshold: micThreshold,
  verbose: true
}).stream().pipe(detector);
