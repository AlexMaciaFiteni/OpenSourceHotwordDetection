const Models = require('snowboy').Models;
const Detector = require('snowboy').Detector;

const http = require('http');
const record = require('node-record-lpcm16');

const Readable = require('stream').Readable;
const Speaker = require('speaker');
const WavFileWriter = require('wav').FileWriter;
const WavReader = require('wav').Reader;
const VAD = require('node-vad');

const vad = new VAD(VAD.Mode.NORMAL);
const wavReader = new WavReader();

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

// LED controller
var ledCnt_ScriptPath = 'led_controller.py';
const {PythonShell} = require('python-shell');
var ledCnt_pyOptions = {
  mode: 'text',
  args: [20],
  pythonPath: '/usr/bin/python'
};
var ledController = new PythonShell(ledCnt_ScriptPath, ledCnt_pyOptions);

ledController.on('message', function(message) {
	console.log(" > PY: "+message);
});

process.on('SIGINT', function() {
  console.log('Control C eh you');
  ledController.send('stop');
  process.exit();
});

// Events
function OnHotword(buffer) {
  if(currentState != 0) return;
  currentState = 1;
  
  console.log('Hotword detected!');
  
  bufferSize = buffer.length;
  silenceStrikes = 0;

  StartFileWriting(resultFilePath);
  StartHTTPRequest();
  
  ledController.send('wakeup');
}

function ClassifyBuffer(buffer) {
  vad.processAudio(buffer, sampleRate).then(res => {
    switch (res) {
        case VAD.Event.ERROR:
        case VAD.Event.SILENCE:
            OnSilence();
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
  if(currentState != 2) ledController.send('listen');
  currentState = 2;
  
  silenceStrikes = 0;
  
  WriteChunkToFile(buffer);
  WriteChunkToServer(buffer);
  
  console.log('Sound');
}

function OnSilence() {
  if(currentState == 1) console.log('Silence but waiting order...');
  if(currentState != 2) return;
  
  silenceStrikes++;
  
  console.log('Silence: '+silenceStrikes);
  // Buffer.alloc(bufferSize, 0)

  if(silenceStrikes >= maxSilenceStrikes)
  {
    currentState = 0;
    FinishFileWriting();
    FinishHTTPRequest();
    ledController.send('think');
  }
}

// Helper actions
function PlayOnSpeakers(data) {
  ledController.send('speak');
	
  wavReader.on('format', function(format) {
    wavReader.pipe(new Speaker(format));
  });
  wavReader.on('end', function() {
    ledController.send('off');
  });
  let speakerStream = new Readable({ read() {} });
  speakerStream.push(data);
  speakerStream.push(null);
  
  speakerStream.pipe(wavReader);
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
  { OnSilence(); });

detector.on('error', function () 
  { console.log('Error in Snowboy'); });

const mic = record.record({
  threshold: micThreshold,
  verbose: true
}).stream().pipe(detector);
