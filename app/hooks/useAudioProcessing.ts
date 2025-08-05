/**
 * Custom hook for audio processing and speech detection
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioProcessingState, AudioBufferState } from '../types/camera';
import { AUDIO_CONFIG } from '../constants/audioConfig';
import { ensureAudioContextActive } from '../utils/mediaUtils';
import { setupAudioWorklet, createAudioAnalyser, createSpeechDetector, processAudioWorkletMessage } from '../utils/audioUtils';
// import { Base64 } from 'js-base64'; // Removed unused import

interface UseAudioProcessingProps {
  stream: MediaStream | null;
  isStreaming: boolean;
  isWebSocketReady: boolean;
  isModelSpeaking: boolean;
  audioContext: AudioContext | null;
  onAudioLevelChange: (level: number) => void;
  onSpeechStateChange: (isSpeaking: boolean) => void;
  onAudioData: (pcmArray: Uint8Array) => void;
}

export const useAudioProcessing = ({
  stream,
  isStreaming,
  isWebSocketReady,
  isModelSpeaking,
  audioContext,
  onAudioLevelChange,
  onSpeechStateChange,
  onAudioData
}: UseAudioProcessingProps): AudioProcessingState => {
  const [isSetup, setIsSetup] = useState(false);
  const [level, setLevel] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isActiveRef = useRef(true);
  const audioBufferRef = useRef<AudioBufferState>({ current: [], previous: [] });

  /**
   * Cleanup function for audio processing resources
   */
  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsSetup(false);
    setLevel(0);
    setIsUserSpeaking(false);
  }, []);

  /**
   * Processes and sends audio data
   */
  const sendAudioData = useCallback(async (pcmArray: Uint8Array) => {
    // Always send audio to backend - let backend handle speech detection
    onAudioData(pcmArray);
    console.log("[Audio] Sent audio chunk:", pcmArray.length, "bytes");
  }, [onAudioData]);

  /**
   * Set up audio processing with Web Audio API and AudioWorklet
   */
  useEffect(() => {
    if (!isWebSocketReady || !audioContext || isSetup || setupInProgress) {
      return;
    }

    // Prevent infinite loop by checking if already in progress
    if (setupInProgress) {
      return;
    }

    isActiveRef.current = true;
    setSetupInProgress(true);

    const setupAudioProcessing = async () => {
      try {
        // Use the audio context from media state
        audioContextRef.current = audioContext;
        const ctx = audioContextRef.current;
        
        if (!ctx || ctx.state === 'closed' || !isActiveRef.current) {
          if (isActiveRef.current) {
            setSetupInProgress(false);
          }
          return;
        }

        // Ensure audio context is active
        await ensureAudioContextActive(ctx);

        // Set up audio worklet
        audioWorkletNodeRef.current = await setupAudioWorklet(ctx);

        if (!isActiveRef.current) {
          if (isActiveRef.current) {
            setSetupInProgress(false);
          }
          return;
        }

        // Create media stream source and analyser
        let source: MediaStreamAudioSourceNode | null = null;
        if (stream) {
          source = ctx.createMediaStreamSource(stream);
          const analyser = createAudioAnalyser(ctx);
          source.connect(analyser);
        }

        // No speech detection needed - sending all audio to backend
        console.log("[Audio] Sending all audio to backend for speech detection");

        // Handle messages from audio worklet
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          if (!isActiveRef.current || isModelSpeaking) {
            return;
          }
          
          const { pcmData, level } = processAudioWorkletMessage(event);
          setLevel(level);
          onAudioLevelChange(level);
          
          // Always send audio to backend
          sendAudioData(new Uint8Array(pcmData));
        };



        // Connect audio source to worklet (if we have a source)
        if (source) {
          source.connect(audioWorkletNodeRef.current);
        }
        setIsSetup(true);
        setSetupInProgress(false);

        return () => {
          isActiveRef.current = false;
          if (source) {
            source.disconnect();
          }
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
          }
          setIsSetup(false);
        };
      } catch (error) {
        console.error('Error setting up audio processing:', error);
        if (isActiveRef.current) {
          cleanupAudio();
        }
        setSetupInProgress(false);
      }
    };

    setupAudioProcessing();

    return () => {
      isActiveRef.current = false;
      setIsSetup(false);
      setSetupInProgress(false);
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
    };
  }, [isStreaming, stream, isWebSocketReady, isModelSpeaking, audioContext, cleanupAudio, sendAudioData, onAudioLevelChange, onSpeechStateChange]);

  return {
    isSetup,
    level,
    isUserSpeaking,
    setupInProgress
  };
}; 