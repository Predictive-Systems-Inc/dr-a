/**
 * VideoDisplay Component
 * 
 * Handles video rendering, camera controls, and connection status overlay
 */

import { forwardRef } from 'react';
import { Button } from "../../../components/ui/button";
import { Video, VideoOff } from "lucide-react";
import { ConnectionStatus } from '../../types/camera';

interface VideoDisplayProps {
  isStreaming: boolean;
  connectionStatus: ConnectionStatus;
  onToggleCamera: () => void;
}

export const VideoDisplay = forwardRef<HTMLVideoElement, VideoDisplayProps>(
  ({ isStreaming, connectionStatus, onToggleCamera }, ref) => {
    return (
      <div className="relative">
        {/* Video display element */}
        <video
          ref={ref}
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

        {/* Camera toggle button */}
        <Button
          onClick={onToggleCamera}
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
    );
  }
);

VideoDisplay.displayName = 'VideoDisplay'; 