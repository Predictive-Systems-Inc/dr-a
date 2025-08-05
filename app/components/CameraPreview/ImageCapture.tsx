/**
 * ImageCapture Component
 * 
 * Handles video frame capture and image sending to WebSocket
 */

import { useRef, useEffect, useCallback } from 'react';
import { UI_CONFIG } from '../../constants/audioConfig';

interface ImageCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  isWebSocketReady: boolean;
  isUserSpeaking: boolean;
  onCaptureImage: (imageData: string) => void;
}

export const ImageCapture = ({
  videoRef,
  isStreaming,
  isWebSocketReady,
  isUserSpeaking,
  onCaptureImage
}: ImageCaptureProps) => {
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Capture and send video frame as image
   */
  const captureAndSendImage = useCallback(() => {
    if (!videoRef.current || !videoCanvasRef.current) return;

    // Only send video when user is speaking
    if (!isUserSpeaking) return;

    const canvas = videoCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match video dimensions
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(videoRef.current, 0, 0);

    // Convert canvas to base64 JPEG and send
    const imageData = canvas.toDataURL('image/jpeg', UI_CONFIG.VIDEO_QUALITY);
    const b64Data = imageData.split(',')[1]; // Remove data URL prefix
    onCaptureImage(b64Data);
  }, [videoRef, isUserSpeaking, onCaptureImage]);

  /**
   * Start image capture interval when WebSocket is ready
   */
  useEffect(() => {
    if (!isStreaming || !isWebSocketReady) return;

    console.log("[ImageCapture] Starting image capture interval");
    
    // Clear any existing interval
    if (imageIntervalRef.current) {
      clearInterval(imageIntervalRef.current);
    }
    
    // Start interval that only sends when user is speaking
    imageIntervalRef.current = setInterval(() => {
      if (isUserSpeaking) {
        captureAndSendImage();
      }
    }, UI_CONFIG.IMAGE_CAPTURE_INTERVAL);

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isStreaming, isWebSocketReady, isUserSpeaking, onCaptureImage, captureAndSendImage]);

  return (
    <canvas ref={videoCanvasRef} className="hidden" />
  );
}; 