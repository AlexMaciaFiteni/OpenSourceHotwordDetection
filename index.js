const Models = require('snowboy').Models;
const Detector = require('snowboy').Detector;

const http = require('http');
const record = require('node-record-lpcm16');

const Readable = require('stream').Readable;
const Speaker = require('speaker');
const WavFileWriter = require('wav').FileWriter;
const VAD = require('node-vad');

const vad = new VAD(VAD.Mode.NORMAL);

// Constants
const voiceServiceHost = '192.168.1.150';
const voiceServicePort = 8080;
const micThreshold = 0;
const sampleRate = 8000;
const resultFilePath = 'res.wav';

const speaker = new Speaker({
  channels: 2,          // 2 channels
  bitDepth: 16,         // 16-bit samples
  sampleRate: 11025
});

let bufferSize = 4096;

// States
const maxSilenceStrikes = 8;
let silenceStrikes = 0;
let currentState = 0;
let stream = null;
let httpRequest = null;

// Events
function OnHotword(buffer) {
  if(currentState != 0) return;
  currentState = 1;
  
  console.log('Hotword detected!');
  
  bufferSize = buffer.length;
  silenceStrikes = 0;

  StartFileWriting(resultFilePath);
  StartHTTPRequest();
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
}

function OnSound(buffer) {
  if(currentState < 1) return; // Only 1 or 2
  currentState = 2;
  
  silenceStrikes = 0;
  
  WriteChunkToFile(buffer);
  WriteChunkToServer(buffer);
  
  console.log('Sound');
}

function OnSilence(buffer) {
  if(currentState == 1) console.log('Silence but waiting order...');
  if(currentState != 2) return;
  
  silenceStrikes++;
  
  console.log('Silence: '+silenceStrikes);

  if(silenceStrikes >= maxSilenceStrikes)
  {
    currentState = 0;
    FinishFileWriting();
    FinishHTTPRequest();
  }
}

// Helper actions
function PlayOnSpeakers(data) {
  let resstream = new WavFileWriter('server.wav', {
    sampleRate: 22050,
    bitDepth: 16,
    channels: 2
  });
  resstream.write(data);
  resstream.end();
  
  let stream = new Readable();
  stream.push(data);
  stream.push(null);
  
  stream.pipe(speaker);
}

function StartFileWriting(filepath) {
  stream = new WavFileWriter(filepath, {
    sampleRate: sampleRate,
    bitDepth: 16,
    channels: 2
  });
}

function WriteChunkToFile(buffer) {
  if(stream) stream.write(buffer);
}

function FinishFileWriting() {
  stream.end();
  stream = null;
}

function StartHTTPRequest() {
  const options = {
    hostname: voiceServiceHost,
    port: voiceServicePort,
    path: '',
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream' // Generic binary data
    }
  };
    
  httpRequest = http.request(options, res => {
    let body = Buffer.alloc(0);
    res.on('data', chunk => { body = Buffer.concat([body, chunk], body.length + chunk.length) });
    res.on('end', () => { PlayOnSpeakers(body); });
  });

  httpRequest.on('error', error => { console.error(error); });
}

function WriteChunkToServer(buffer) {
  if(httpRequest) httpRequest.write(buffer);
}

function FinishHTTPRequest() {
  httpRequest.end();
  httpRequest = null;
}

// Snowboy data
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
