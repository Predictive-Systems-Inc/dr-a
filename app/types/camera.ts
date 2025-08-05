/**
 * Type definitions for CameraPreview component and related functionality
 */

export interface CameraPreviewProps {
  onTranscription: (text: string, date: Date, isHuman: boolean) => void;
  onStreamingStateChange: (isStreaming: boolean) => void;
  className?: string;
  topic: string;
}

export interface AudioProcessingState {
  isSetup: boolean;
  level: number;
  isUserSpeaking: boolean;
  setupInProgress: boolean;
}

export interface WebSocketState {
  status: 'disconnected' | 'connecting' | 'connected';
  isReady: boolean;
  isModelSpeaking: boolean;
  outputLevel: number;
}

export interface MediaState {
  isStreaming: boolean;
  stream: MediaStream | null;
}

export interface AudioBufferState {
  current: Uint8Array[];
  previous: Uint8Array[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface AudioWorkletMessage {
  pcmData: ArrayBuffer;
  level: number;
}

export interface MediaDeviceConstraints {
  video: boolean;
  audio: {
    sampleRate: number;
    channelCount: number;
    echoCancellation: boolean;
    autoGainControl: boolean;
    noiseSuppression: boolean;
  };
} 