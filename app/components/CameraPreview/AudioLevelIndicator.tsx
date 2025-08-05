/**
 * AudioLevelIndicator Component
 * 
 * Displays audio input/output levels and user speaking status
 */

interface AudioLevelIndicatorProps {
  audioLevel: number;
  outputAudioLevel: number;
  isModelSpeaking: boolean;
  isUserSpeaking: boolean;
}

export const AudioLevelIndicator = ({
  audioLevel,
  outputAudioLevel,
  isModelSpeaking,
  isUserSpeaking
}: AudioLevelIndicatorProps) => {
  return (
    <>
      {/* Audio level progress bar */}
      <div className="w-[640px] h-2 rounded-full bg-green-100">
        <div
          className="h-full rounded-full transition-all bg-green-500"
          style={{ 
            width: `${isModelSpeaking ? outputAudioLevel : audioLevel}%`,
            transition: 'width 100ms ease-out'
          }}
        />
      </div>
      
      {/* Status text */}
      <div className="text-sm text-gray-500">
        Status: {isUserSpeaking ? 'Speaking' : 'Silent'}
        {isUserSpeaking && (
          <span className="ml-2 text-green-600 font-medium">
            • Sending media
          </span>
        )}
      </div>
    </>
  );
}; 