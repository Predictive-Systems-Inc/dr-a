/**
 * CameraPreview Component
 * 
 * This component handles real-time video and audio capture for AI-powered conversations.
 * It integrates with Gemini WebSocket for real-time transcription and response generation.
 * 
 * Features include:
 * - Video capture and display
 * - Real-time audio processing with speech detection
 * - Audio worklet processing for low-latency audio handling
 * - Image capture when user is speaking
 * - WebSocket communication with Gemini AI
 */

"use client";

import { useRef, useEffect, useCallback } from 'react';
import { CameraPreviewProps } from '../../types/camera';
import { useMediaState } from '../../hooks/useMediaState';
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection';
import { useAudioProcessing } from '../../hooks/useAudioProcessing';
import { VideoDisplay } from './VideoDisplay';
import { AudioLevelIndicator } from './AudioLevelIndicator';
import { ImageCapture } from './ImageCapture';

export default function CameraPreview({ 
  onTranscription, 
  onStreamingStateChange,
  className = '',
  topic 
}: CameraPreviewProps) {
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Custom hooks for state management
  const { mediaState, toggleCamera, audioContext } = useMediaState();
  const { 
    status: connectionStatus, 
    isReady: isWebSocketReady, 
    isModelSpeaking, 
    outputLevel, 
    sendAudioData, 
    sendImageData 
  } = useWebSocketConnection({
    isStreaming: mediaState.isStreaming,
    topic,
    onTranscription
  });
  
  // Memoize callback functions to prevent infinite loops
  const handleAudioLevelChange = useCallback((level: number) => {
    //console.log('Audio level:', level);
  }, []);

  const handleSpeechStateChange = useCallback((isSpeaking: boolean) => {
    console.log('Speech state:', isSpeaking);
  }, []);

  const { 
    level: audioLevel, 
    isUserSpeaking 
  } = useAudioProcessing({
    stream: mediaState.stream,
    isStreaming: mediaState.isStreaming,
    isWebSocketReady,
    isModelSpeaking,
    audioContext,
    onAudioLevelChange: handleAudioLevelChange,
    onSpeechStateChange: handleSpeechStateChange,
    onAudioData: sendAudioData
  });

  // Set up video element when stream changes
  useEffect(() => {
    if (videoRef.current && mediaState.stream) {
      videoRef.current.srcObject = mediaState.stream;
      videoRef.current.muted = true; // Mute to prevent feedback
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [mediaState.stream]);

  // Notify parent component when streaming state changes
  useEffect(() => {
    onStreamingStateChange?.(mediaState.isStreaming);
  }, [mediaState.isStreaming, onStreamingStateChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video display with camera controls */}
      <VideoDisplay
        ref={videoRef}
        isStreaming={mediaState.isStreaming}
        connectionStatus={connectionStatus}
        onToggleCamera={toggleCamera}
      />
      
      {/* Audio level indicator and status */}
      {mediaState.isStreaming && (
        <AudioLevelIndicator
          audioLevel={audioLevel}
          outputAudioLevel={outputLevel}
          isModelSpeaking={isModelSpeaking}
          isUserSpeaking={isUserSpeaking}
        />
      )}
      
      {/* Image capture component */}
      <ImageCapture
        videoRef={videoRef}
        isStreaming={mediaState.isStreaming}
        isWebSocketReady={isWebSocketReady}
        isUserSpeaking={isUserSpeaking}
        onCaptureImage={sendImageData}
      />
    </div>
  );
} 