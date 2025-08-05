/**
 * Audio utilities for processing and speech detection
 */

import { AUDIO_CONFIG } from '../constants/audioConfig';
import { AudioWorkletMessage } from '../types/camera';

/**
 * Sets up audio worklet for real-time audio processing
 */
export const setupAudioWorklet = async (ctx: AudioContext): Promise<AudioWorkletNode> => {
  await ctx.audioWorklet.addModule('/worklets/audio-processor.js');

  const workletNode = new AudioWorkletNode(ctx, 'audio-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    processorOptions: {
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      bufferSize: AUDIO_CONFIG.BUFFER_SIZE,
    },
    channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers'
  });
  
  return workletNode;
};

/**
 * Creates an analyser node for audio level detection
 */
export const createAudioAnalyser = (ctx: AudioContext): AnalyserNode => {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = AUDIO_CONFIG.BUFFER_SIZE;
  return analyser;
};

/**
 * Speech detection function using Web Audio API AnalyserNode
 * Monitors audio levels to detect when user is speaking vs silent
 */
export const createSpeechDetector = (
  analyser: AnalyserNode,
  onSpeechStart: () => void,
  onSpeechEnd: () => void
): (() => void) => {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const samples: number[] = [];
  const maxSamples = 10;
  let silentStartTime = 0;
  let lastAudioState = false;

  const intervalId = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const average = sum / dataArray.length;

    samples.push(average);
    if (samples.length > maxSamples) samples.shift();

    const overallAverage = samples.reduce((acc, val) => acc + val, 0) / samples.length;
    const isSpeaking = overallAverage > AUDIO_CONFIG.SPEECH_THRESHOLD;

    if (isSpeaking) {
      silentStartTime = 0;
      if (!lastAudioState) {
        console.log("[Speech] Speech detected! Average level:", overallAverage);
        lastAudioState = true;
        onSpeechStart();
      }
    } else {
      if (silentStartTime === 0) {
        silentStartTime = Date.now();
      }
      
      if (Date.now() - silentStartTime >= AUDIO_CONFIG.SILENCE_DURATION && lastAudioState) {
        console.log("[Speech] Speech ended. Silence duration:", Date.now() - silentStartTime, "ms");
        lastAudioState = false;
        onSpeechEnd();
      }
    }
  }, AUDIO_CONFIG.AUDIO_DETECTION_INTERVAL);

  return () => clearInterval(intervalId);
};

/**
 * Processes audio worklet messages and extracts PCM data and level
 */
export const processAudioWorkletMessage = (event: MessageEvent): AudioWorkletMessage => {
  const { pcmData, level } = event.data;
  return {
    pcmData,
    level
  };
};

/**
 * Converts PCM data to base64 for WebSocket transmission
 */
export const pcmToBase64 = (pcmArray: Uint8Array): string => {
  // This would use the Base64 library from js-base64
  // For now, we'll return a placeholder
  return btoa(String.fromCharCode(...pcmArray));
};

/**
 * Converts PCM data to WAV format
 */
export const pcmToWav = (pcmData: string, sampleRate: number = 16000): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Decode base64 PCM data
      const binaryString = atob(pcmData);
      const pcmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }

      // Convert bytes to samples (assuming 16-bit PCM)
      const samples = new Int16Array(pcmBytes.buffer);

      // Create WAV header
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);

      const pcmByteLength = samples.length * 2; // 16-bit = 2 bytes per sample

      // "RIFF" chunk descriptor
      view.setUint8(0, 'R'.charCodeAt(0));
      view.setUint8(1, 'I'.charCodeAt(0));
      view.setUint8(2, 'F'.charCodeAt(0));
      view.setUint8(3, 'F'.charCodeAt(0));

      // File length (header size + data size)
      view.setUint32(4, 36 + pcmByteLength, true);

      // "WAVE" format
      view.setUint8(8, 'W'.charCodeAt(0));
      view.setUint8(9, 'A'.charCodeAt(0));
      view.setUint8(10, 'V'.charCodeAt(0));
      view.setUint8(11, 'E'.charCodeAt(0));

      // "fmt " sub-chunk
      view.setUint8(12, 'f'.charCodeAt(0));
      view.setUint8(13, 'm'.charCodeAt(0));
      view.setUint8(14, 't'.charCodeAt(0));
      view.setUint8(15, ' '.charCodeAt(0));

      // Sub-chunk size
      view.setUint32(16, 16, true);
      // Audio format (PCM = 1)
      view.setUint16(20, 1, true);
      // Number of channels
      view.setUint16(22, 1, true);
      // Sample rate
      view.setUint32(24, sampleRate, true);
      // Byte rate
      view.setUint32(28, sampleRate * 2, true);
      // Block align
      view.setUint16(32, 2, true);
      // Bits per sample
      view.setUint16(34, 16, true);

      // "data" sub-chunk
      view.setUint8(36, 'd'.charCodeAt(0));
      view.setUint8(37, 'a'.charCodeAt(0));
      view.setUint8(38, 't'.charCodeAt(0));
      view.setUint8(39, 'a'.charCodeAt(0));

      // Data size
      view.setUint32(40, pcmByteLength, true);

      // Create final buffer
      const wavBuffer = new ArrayBuffer(wavHeader.byteLength + pcmByteLength);
      const wavBytes = new Uint8Array(wavBuffer);

      // Copy header and PCM data
      wavBytes.set(new Uint8Array(wavHeader), 0);
      wavBytes.set(new Uint8Array(samples.buffer), wavHeader.byteLength);

      // Use Blob and FileReader to convert to base64
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (base64data) {
          resolve(base64data);
        } else {
          reject(new Error("Failed to convert WAV to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}; 