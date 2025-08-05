/**
 * Custom hook for media state management (camera/audio streams)
 */

import { useState, useCallback } from 'react';
import { MediaState } from '../types/camera';
import { setupMediaStreams, cleanupMediaStreams, createAudioContext } from '../utils/mediaUtils';

export const useMediaState = (): {
  mediaState: MediaState;
  toggleCamera: () => Promise<void>;
  audioContext: AudioContext | null;
} => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  /**
   * Toggles camera and audio capture on/off
   */
  const toggleCamera = useCallback(async () => {
    if (isStreaming && stream) {
      // Stop streaming and cleanup resources
      setIsStreaming(false);
      cleanupMediaStreams(stream);
      setStream(null);
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
      }
    } else {
      try {
        // Set up media streams
        const combinedStream = await setupMediaStreams();
        
        // Create audio context
        const ctx = createAudioContext();
        
        setStream(combinedStream);
        setAudioContext(ctx);
        setIsStreaming(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Error accessing media devices:', {
          error: err,
          message: errorMessage,
          hasNavigator: typeof navigator !== 'undefined',
          hasMediaDevices: Boolean(navigator?.mediaDevices),
          hasGetUserMedia: Boolean(navigator?.mediaDevices?.getUserMedia)
        });
        alert(`Failed to access camera/microphone: ${errorMessage}\nPlease check browser permissions and try again.`);
      }
    }
  }, [isStreaming, stream, audioContext]);

  return {
    mediaState: {
      isStreaming,
      stream
    },
    toggleCamera,
    audioContext
  };
}; 