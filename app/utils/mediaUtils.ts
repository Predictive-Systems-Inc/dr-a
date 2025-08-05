/**
 * Media utilities for camera and audio stream management
 */

import { AUDIO_CONFIG } from '../constants/audioConfig';
import { MediaDeviceConstraints } from '../types/camera';

/**
 * Validates browser environment and media device support
 */
export const validateMediaSupport = (): void => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access media devices outside browser environment');
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported in this browser');
  }
};

/**
 * Sets up video and audio streams with optimal settings for speech recognition
 */
export const setupMediaStreams = async (): Promise<MediaStream> => {
  validateMediaSupport();

  // Get video stream (camera)
  const videoStream = await navigator.mediaDevices.getUserMedia({ 
    video: true,
    audio: false  // Get audio separately for better control
  });

  // Get audio stream with specific settings for speech recognition
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
      echoCancellation: AUDIO_CONFIG.ECHO_CANCELLATION,
      autoGainControl: AUDIO_CONFIG.AUTO_GAIN_CONTROL,
      noiseSuppression: AUDIO_CONFIG.NOISE_SUPPRESSION,
    }
  });

  // Combine video and audio streams
  return new MediaStream([
    ...videoStream.getTracks(),
    ...audioStream.getTracks()
  ]);
};

/**
 * Cleans up media streams and stops all tracks
 */
export const cleanupMediaStreams = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

/**
 * Creates an AudioContext with optimal settings for speech processing
 */
export const createAudioContext = (): AudioContext => {
  return new AudioContext({
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
  });
};

/**
 * Validates and resumes audio context if suspended
 */
export const ensureAudioContextActive = async (ctx: AudioContext): Promise<void> => {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}; 