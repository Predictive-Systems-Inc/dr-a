/**
 * Audio configuration constants
 * Centralized settings for audio processing and speech detection
 */

export const AUDIO_CONFIG = {
  // Audio processing settings
  SAMPLE_RATE: 16000,
  BUFFER_SIZE: 256,
  CHANNEL_COUNT: 1,
  
  // Speech detection settings
  MAX_AUDIO_PREV_SIZE: 10,  // Keep last 150ms of audio (150ms / 16ms per chunk = ~10 chunks)
  SPEECH_THRESHOLD: 10,     // Lowered from 30 to 10 for testing
  SILENCE_DURATION: 100,     // ms before marking as not speaking
  AUDIO_DETECTION_INTERVAL: 100, // ms between audio level checks
  
  // Audio quality settings
  ECHO_CANCELLATION: true,
  AUTO_GAIN_CONTROL: true,
  NOISE_SUPPRESSION: true,
} as const;

export const UI_CONFIG = {
  IMAGE_CAPTURE_INTERVAL: 1000, // ms between image captures
  VIDEO_QUALITY: 0.8,           // JPEG quality for image capture
  AUDIO_LEVEL_UPDATE_INTERVAL: 100, // ms for audio level bar updates
} as const; 