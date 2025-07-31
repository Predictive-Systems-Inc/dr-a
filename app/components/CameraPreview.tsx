// app/components/CameraPreview.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "../../components/ui/button";
import { Video, VideoOff } from "lucide-react";
import { GeminiWebSocket } from '../services/geminiWebSocket';
import { Base64 } from 'js-base64';
import { pcmToWavArray } from '../utils/audioUtils';

interface CameraPreviewProps {
  onTranscription: (text: string, date: Date, isHuman: boolean) => void;
  onStreamingStateChange: (isStreaming: boolean) => void;
  className?: string;
  topic: string;
}

export default function CameraPreview({ 
      onTranscription, 
      onStreamingStateChange,
      className = '',
      topic }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [isAudioSetup, setIsAudioSetup] = useState(false);
  const setupInProgressRef = useRef(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState(false);
  const imageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const lastAudioStateRef = useRef<boolean>(false);
  const audioBufferRef = useRef<Uint8Array[]>([]);
  const audioPrevRef = useRef<Uint8Array[]>([]);

  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
      geminiWsRef.current = null;
    }
  }, []);

  // Add an effect to notify parent component when streaming state changes
  useEffect(() => {
    onStreamingStateChange?.(isStreaming);
  }, [isStreaming, onStreamingStateChange]);
  
  const detectAudio = (analyser: AnalyserNode): () => void => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const samples: number[] = [];
    const maxSamples = 10;
    const threshold = 30;
    let silentStartTime = 0;

    const intervalId = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      const sum = dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / dataArray.length;
  
      samples.push(average);
      if (samples.length > maxSamples) samples.shift();
  
      const overallAverage = samples.reduce((acc, val) => acc + val, 0) / samples.length;
      const isSpeaking = overallAverage > threshold;

      if (isSpeaking) {
        // Reset silent timer when sound is detected
        silentStartTime = 0;
        if (!lastAudioStateRef.current) {
          lastAudioStateRef.current = true;
          setIsUserSpeaking(true);
        }
      } else {
        // Start tracking silence duration
        if (silentStartTime === 0) {
          silentStartTime = Date.now();
        }
        
        // Check if been silent for 100ms
        if (Date.now() - silentStartTime >= 100 && lastAudioStateRef.current) {
          lastAudioStateRef.current = false;
          setIsUserSpeaking(false);
        }
      }
    }, 100);

    // Return cleanup function
    return () => clearInterval(intervalId);
  };

  const sendAudioData = async (pcmArray: Uint8Array) => {
    if (!geminiWsRef.current) return;
    // keep stack of last 10 audio buffers
    audioPrevRef.current.push(pcmArray);
    if (audioPrevRef.current.length > 10) {
      audioPrevRef.current.shift();
    }
    
    if (lastAudioStateRef.current) {      // add audioPrevRef to audioBufferRef 
      if (audioBufferRef.current.length === 0) {
        audioBufferRef.current = audioPrevRef.current;
      } else {
        audioBufferRef.current.push(pcmArray);
      }
      audioPrevRef.current = [];
    } else if (audioBufferRef.current.length > 10) {
      try {
        
        // Combine all the arrays into one
        const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const arr of audioBufferRef.current) {
          combinedArray.set(arr, offset);
          offset += arr.length;
        }
        
        // Clear the buffer
        audioBufferRef.current = [];

       // Convert PCM to WAV format
       const wavArray = await pcmToWavArray(combinedArray, 16000);
        
       // Convert WAV to base64
       const wavBase64 = Base64.fromUint8Array(wavArray);        
        // Send for transcription
        if (geminiWsRef.current) {
          const transcriptionDate = new Date();
          const transcription = await geminiWsRef.current.transcribeAudio(wavBase64);
          if (transcription && !transcription.includes("provide the audio") && !transcription.includes("audio contains")) {
            console.log('Transcription:', transcription);
            onTranscription(transcription, transcriptionDate, true);
          }
        }
        
      } catch (error) {
        console.error('Error processing audio data for transcription:', error);
        audioBufferRef.current = []; // Clear buffer on error
      }
    } else if (audioBufferRef.current.length > 0) {
      // Not enough audio data to transcribe
      console.log('Not enough audio data to transcribe, clearing buffer');
      audioBufferRef.current = [];
    }

    const b64Data = Base64.fromUint8Array(pcmArray);
    geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");

  };

  const toggleCamera = async () => {
    if (isStreaming && stream) {
      setIsStreaming(false);
      cleanupWebSocket();
      cleanupAudio();
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    } else {
      try {
        // Check if we're in the browser environment
        if (typeof window === 'undefined') {
          throw new Error('Cannot access media devices outside browser environment');
        }

        // Check for mediaDevices support
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser');
        }
        
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false
        });

        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          }
        });

        audioContextRef.current = new AudioContext({
          sampleRate: 16000,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
          videoRef.current.muted = true;
        }

        const combinedStream = new MediaStream([
          ...videoStream.getTracks(),
          ...audioStream.getTracks()
        ]);

        setStream(combinedStream);
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
        cleanupAudio();
      }
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isStreaming) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    geminiWsRef.current = new GeminiWebSocket(
      (text) => {
        console.log("Received from Gemini:", text);
      },
      () => {
        console.log("[Camera] WebSocket setup complete, starting media capture");
        setIsWebSocketReady(true);
        setConnectionStatus('connected');
      },
      (isPlaying) => {
        setIsModelSpeaking(isPlaying);
      },
      (level) => {
        setOutputAudioLevel(level);
      },
      onTranscription,
      topic as "Displacement and Velocity" | "Soccer" | "Acceleration" | "Newton's Laws of Motion" | "Freefall and Projectile Motion" | "Circular Motion" | undefined
    );
    geminiWsRef.current.connect();

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      // Only cleanup if we're actually streaming
      if (isStreaming) {
        cleanupWebSocket();
        cleanupAudio();
        setIsWebSocketReady(false);
        setConnectionStatus('disconnected');
      }
    };
  }, [isStreaming, onTranscription, cleanupWebSocket, cleanupAudio, topic]);

  // Start image capture only after WebSocket is ready
  useEffect(() => {
    if (!isStreaming || !isWebSocketReady) return;

    console.log("[Camera] Starting image capture interval");
    imageIntervalRef.current = setInterval(captureAndSendImage, 1000);

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isStreaming, isWebSocketReady]);

  // Update audio processing setup
  useEffect(() => {
    if (!isStreaming || !stream || !audioContextRef.current || 
        !isWebSocketReady || isAudioSetup || setupInProgressRef.current) return;

    let isActive = true;
    setupInProgressRef.current = true;

    const setupAudioProcessing = async () => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'closed' || !isActive) {
          setupInProgressRef.current = false;
          return;
        }

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule('/worklets/audio-processor.js');

        if (!isActive) {
          setupInProgressRef.current = false;
          return;
        }

        audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000,
            bufferSize: 4096,  // Larger buffer size like original
          },
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        });

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Setup audio detection and store cleanup function
        detectAudio(analyser);
  
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          if (!isActive || isModelSpeaking) return;
          const { pcmData, level } = event.data;
          setAudioLevel(level);

          // Pass the PCM array directly without base64 conversion
          sendAudioData(new Uint8Array(pcmData));
        };

        source.connect(audioWorkletNodeRef.current);
        setIsAudioSetup(true);
        setupInProgressRef.current = false;

        return () => {
          source.disconnect();
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
          }
          setIsAudioSetup(false);
        };
      } catch (error) {
        console.error('Error setting up audio processing:', error);
        if (isActive) {
          cleanupAudio();
          setIsAudioSetup(false);
        }
        setupInProgressRef.current = false;
      }
    };

    console.log("[Camera] Starting audio processing setup");
    setupAudioProcessing();

    return () => {
      isActive = false;
      setIsAudioSetup(false);
      setupInProgressRef.current = false;
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
    };
  }, [isStreaming, stream, isWebSocketReady, isModelSpeaking]);

  // Capture and send image
  const captureAndSendImage = () => {
    if (!videoRef.current || !videoCanvasRef.current || !geminiWsRef.current) return;

    const canvas = videoCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Draw video frame to canvas
    context.drawImage(videoRef.current, 0, 0);

    // Convert to base64 and send
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const b64Data = imageData.split(',')[1];
    geminiWsRef.current.sendMediaChunk(b64Data, "image/jpeg");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-[640px] h-[480px] bg-muted rounded-lg overflow-hidden"
        />
        
        {/* Connection Status Overlay */}
        {isStreaming && connectionStatus !== 'connected' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg backdrop-blur-sm">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
              <p className="text-white font-medium">
                {connectionStatus === 'connecting' ? 'Connecting to Gemini...' : 'Disconnected'}
              </p>
              <p className="text-white/70 text-sm">
                Please wait while we establish a secure connection
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={toggleCamera}
          size="icon"
          className={`absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full w-12 h-12 backdrop-blur-sm transition-colors
            ${isStreaming 
              ? 'bg-red-500/50 hover:bg-red-500/70 text-white' 
              : 'bg-green-500/50 hover:bg-green-500/70 text-white'
            }`}
        >
          {isStreaming ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>
      </div>
      {isStreaming && (
        <>
          <div className="w-[640px] h-2 rounded-full bg-green-100">
            <div
              className="h-full rounded-full transition-all bg-green-500"
              style={{ 
                width: `${isModelSpeaking ? outputAudioLevel : audioLevel}%`,
                transition: 'width 100ms ease-out'
              }}
            />
          </div>
          <div className="text-sm text-gray-500">
            Status: {isUserSpeaking ? 'Speaking' : 'Silent'}
          </div>
        </>
      )}
      <canvas ref={videoCanvasRef} className="hidden" />
    </div>
  );
}
