import { TranscriptionService } from './transcriptionService';
import { pcmToWav } from '../utils/audioUtils';

const MODEL = "models/gemini-2.5-flash-live-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
// const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
const WS_URL = `ws://localhost:8080/ws/psi.be.v0.gemma3n.GenerateContent`;


const TOPIC_INSTRUCTIONS = {
  "Displacement and Velocity": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on the concepts of displacement and velocity." },
      { text: "You will ask series of questions to assess the student's understanding of these concepts." },
      { text: "Make sure to ask follow up questions to clarify the student's response and get sufficient information to assess their understanding." },
      { text: "Cover the following topics: distance vs displacement, speed vs velocity, vector quantities, and graphical analysis of motion." },
      { text: "You speak like vice ganda in filipino to make student comfortable depending on their response." },
    ]
  },
  "Soccer": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on projectile motion using soccer scenarios." },
      { text: "You will ask series of questions to assess the student's understanding of projectile motion in soccer." },
      { text: "Use this figure to help you explain the problem and given scenario: " },
      { text: "The soccer player kicks the ball in the Figure above with an initial velocity of 35 m/s at an angle of 20⁰. (a) Calculate for the time when it reaches 0.40 m. (b) Find its position parallel to the field at height equal to 0.40 m. (c) Find the time when it reaches its highest point. (d) At what point is the ball at its highest and farthest?" },
      { text: "Make sure to ask follow up questions about the soccer ball's trajectory, time of flight, and maximum height." },
      { text: "Cover the following topics: initial velocity, launch angle, time to reach specific heights, maximum height, and horizontal distance." },
      { text: "You speak in English to make student comfortable depending on their response." },      
    ]
  },
  "Acceleration": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on the concept of acceleration." },
      { text: "You will ask series of questions to assess the student's understanding of acceleration." },
      { text: "Make sure to ask follow up questions about acceleration in different scenarios: speeding up, slowing down, and changing direction." },
      { text: "Cover the following topics: definition of acceleration, units of measurement, acceleration due to gravity, and acceleration in everyday situations." },
      { text: "You speak in English to make student comfortable depending on their response." },
    ]
  },
  "Newton's Laws of Motion": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on Newton's Laws of Motion." },
      { text: "You will ask series of questions to assess the student's understanding of all three laws." },
      { text: "Make sure to ask follow up questions about real-world applications of each law." },
      { text: "Cover the following topics: inertia, force and acceleration relationships, action-reaction pairs." },
      { text: "You speak in English to make student comfortable depending on their response." },
    ]
  },
  "Freefall and Projectile Motion": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on the concepts of freefall and projectile motion." },
      { text: "You will ask series of questions to assess the student's understanding of these concepts." },
      { text: "Make sure to ask follow up questions to clarify the student's response and get sufficient information to assess their understanding." },
      { text: "Cover the following topics: freefall, projectile motion, and the effect of gravity on moving objects." },
      { text: "You speak in English to make student comfortable depending on their response." },
    ]
  },
  "Circular Motion": {
    parts: [
      { text: "You are Teacher A, a teacher that reviews students on circular motion." },
      { text: "You will ask series of questions to assess the student's understanding of objects moving in circles." },
      { text: "Make sure to ask follow up questions about centripetal force, angular velocity, and period of rotation." },
      { text: "Cover the following topics: uniform circular motion, centripetal acceleration, and real-world applications." },
      { text: "You speak in English to make student comfortable depending on their response." },
    ]
  }
} as const;

export class GeminiWebSocket {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback: ((text: string) => void) | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private audioContext: AudioContext | null = null;

  // Audio queue management
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingResponse: boolean = false;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onTranscriptionCallback: ((text: string, date: Date, isHuman: boolean) => void) | null = null;
  private transcriptionService: TranscriptionService;
  private accumulatedPcmData: string[] = [];
  private currentTopic: keyof typeof TOPIC_INSTRUCTIONS = "Freefall and Projectile Motion";

  constructor(
    onMessage: (text: string) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string, date: Date, isHuman: boolean) => void,
    initialTopic: keyof typeof TOPIC_INSTRUCTIONS = "Freefall and Projectile Motion"
  ) {
    this.onMessageCallback = onMessage;
    this.onSetupCompleteCallback = onSetupComplete;
    this.onPlayingStateChange = onPlayingStateChange;
    this.onAudioLevelChange = onAudioLevelChange;
    this.onTranscriptionCallback = onTranscription;
    // Create AudioContext for playback
    this.audioContext = new AudioContext({
      sampleRate: 16000  // Match the response audio rate
    });
    this.transcriptionService = new TranscriptionService();
    this.currentTopic = initialTopic;
  }

  connect() {
    // Prevent multiple connections
    if (this.ws?.readyState === WebSocket.CONNECTING || 
        this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendInitialSetup();
      };

      this.ws.onmessage = async (event) => {
        try {
          let messageText: string;
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            messageText = new TextDecoder('utf-8').decode(bytes);
          } else {
            messageText = event.data;
          }

          await this.handleMessage(messageText);
        } catch (error) {
          console.error("[WebSocket] Error processing message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;

        // Only attempt to reconnect if we haven't explicitly called disconnect
        if (!event.wasClean && this.isSetupComplete) {
          setTimeout(() => this.connect(), 1000);
        }
      };
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);
      // Add retry logic
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, 2000);
    }
  }

  private sendInitialSetup() {
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: "aoede"
              }
            }
          },
          temperature: 0.01,
          max_output_tokens: 300,
        },
        system_instruction: {
          parts: TOPIC_INSTRUCTIONS[this.currentTopic].parts,
        },
      },
    };
    console.log('currentTopic', this.currentTopic);
    console.log("[Setup Message]:", setupMessage);
    this.ws?.send(JSON.stringify(setupMessage));
  }

  sendMediaChunk(b64Data: string, mimeType: string) {
    if (!this.isConnected || !this.ws || !this.isSetupComplete) return;
    console.log("[Sending Media Chunk]:", mimeType);

    const message = {
      realtime_input: {
        media_chunks: [{
          mime_type: mimeType === "audio/pcm" ? "audio/pcm" : mimeType,
          data: b64Data
        }]
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Error sending media chunk:", error);
    }
  }

  sendTurnComplete() {
    if (!this.isConnected || !this.ws || !this.isSetupComplete) return;
    console.log("[Sending Turn Complete]");

    const message = {
      realtime_input: {
        turn_complete: true
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Error sending turn complete:", error);
    }
  }

  private async playAudioResponse(base64Data: string) {
    if (!this.audioContext) return;

    try {
      // Decode base64 to bytes
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM format)
      const pcmData = new Int16Array(bytes.buffer);

      // Convert to float32 for Web Audio API
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      // Add to queue and start playing if not already playing
      this.audioQueue.push(float32Data);
      this.playNextInQueue();
    } catch (error) {
      console.error("[WebSocket] Error processing audio:", error);
    }
  }

  private async playNextInQueue() {
    if (!this.audioContext || this.isPlaying || this.audioQueue.length === 0) return;

    try {
      this.isPlaying = true;
      this.isPlayingResponse = true;
      this.onPlayingStateChange?.(true);
      const float32Data = this.audioQueue.shift()!;

      // Calculate audio level
      let sum = 0;
      for (let i = 0; i < float32Data.length; i++) {
        sum += Math.abs(float32Data[i]);
      }
      const level = Math.min((sum / float32Data.length) * 100 * 5, 100);
      this.onAudioLevelChange?.(level);

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Data.length,
        24000
      );
      audioBuffer.getChannelData(0).set(float32Data);

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      this.currentSource.onended = () => {
        this.isPlaying = false;
        this.currentSource = null;
        if (this.audioQueue.length === 0) {
          this.isPlayingResponse = false;
          this.onPlayingStateChange?.(false);
        }
        this.playNextInQueue();
      };

      this.currentSource.start();
    } catch (error) {
      console.error("[WebSocket] Error playing audio:", error);
      this.isPlaying = false;
      this.isPlayingResponse = false;
      this.onPlayingStateChange?.(false);
      this.currentSource = null;
      this.playNextInQueue();
    }
  }

  private stopCurrentAudio() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.isPlayingResponse = false;
    this.onPlayingStateChange?.(false);
    this.audioQueue = []; // Clear queue
  }

  private async handleMessage(message: string) {
    try {
      const messageData = JSON.parse(message);

      if (messageData.setupComplete) {
        this.isSetupComplete = true;
        this.onSetupCompleteCallback?.();
        return;
      }

      // Handle audio data
      if (messageData.serverContent?.modelTurn?.parts) {
        const parts = messageData.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData?.mimeType === "audio/pcm;rate=24000") {
            this.accumulatedPcmData.push(part.inlineData.data);
            this.playAudioResponse(part.inlineData.data);
          }
        }
      }

      // Handle turn completion separately
      if (messageData.serverContent?.turnComplete === true) {
        if (this.accumulatedPcmData.length > 0) {
          try {
            const fullPcmData = this.accumulatedPcmData.join('');
            const wavData = await pcmToWav(fullPcmData, 24000);
            const transcriptionDate = new Date();

            const transcription = await this.transcriptionService.transcribeAudio(
              wavData,
              "audio/wav"
            );
            console.log("[Transcription]:", transcription);

            this.onTranscriptionCallback?.(transcription, transcriptionDate, false);
            this.accumulatedPcmData = []; // Clear accumulated data
          } catch (error) {
            console.error("[WebSocket] Transcription error:", error);
          }
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", error);
    }
  }

  async transcribeAudio(wavData: string) {
    
    return await this.transcriptionService.transcribeAudio(
      wavData, 
      "audio/wav");
  }

  disconnect() {
    this.isSetupComplete = false;
    this.isConnected = false; // Set this first
    
    if (this.ws) {
      try {
        this.ws.close(1000, "Intentional disconnect");
      } catch (error) {
        console.warn("[WebSocket] Error during disconnect:", error);
      }
      this.ws = null;
    }
    
    this.accumulatedPcmData = [];
    this.stopCurrentAudio();
  }

  setTopic(topic: keyof typeof TOPIC_INSTRUCTIONS) {
    this.currentTopic = topic;
    
    // Clean up existing connection
    if (this.ws) {
      this.stopCurrentAudio(); // Stop any playing audio
      this.audioQueue = []; // Clear audio queue
      this.accumulatedPcmData = []; // Clear accumulated data
      
      // Only disconnect and reconnect if currently connected
      if (this.isConnected) {
        this.disconnect();
        // Add a small delay before reconnecting to ensure clean disconnect
        setTimeout(() => {
          this.connect();
        }, 500);
      }
    }
  }
} 