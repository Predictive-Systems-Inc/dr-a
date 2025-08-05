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

// Re-export the refactored component
export { default } from './CameraPreview/index';
