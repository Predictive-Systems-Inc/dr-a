# CameraPreview Component Refactoring

This directory contains the refactored CameraPreview component, which has been broken down into smaller, more maintainable pieces.

## Structure

```
CameraPreview/
├── index.tsx              # Main component (entry point)
├── VideoDisplay.tsx        # Video rendering and camera controls
├── AudioLevelIndicator.tsx # Audio level display and status
├── ImageCapture.tsx        # Video frame capture and sending
└── README.md              # This documentation
```

## Custom Hooks

The main component uses several custom hooks for state management:

- `useMediaState()` - Manages camera/audio stream state
- `useWebSocketConnection()` - Handles WebSocket communication with Gemini
- `useAudioProcessing()` - Manages audio processing and speech detection

## Utilities

- `mediaUtils.ts` - Media device access and stream management
- `audioUtils.ts` - Audio processing and speech detection utilities
- `audioConfig.ts` - Centralized audio configuration constants

## Types

- `camera.ts` - TypeScript interfaces for the component

## Benefits of Refactoring

1. **Single Responsibility**: Each component/hook has one clear purpose
2. **Reusability**: Hooks can be reused in other components
3. **Testability**: Smaller units are easier to test
4. **Maintainability**: Changes are isolated to specific areas
5. **Readability**: Clear separation of concerns
6. **Type Safety**: Better TypeScript support with proper types
7. **Performance**: Easier to optimize specific parts
8. **Debugging**: Easier to identify issues in smaller components

## Usage

The component is used exactly the same as before:

```tsx
<CameraPreview
  onTranscription={(text, date, isHuman) => console.log(text)}
  onStreamingStateChange={(isStreaming) => setStreaming(isStreaming)}
  topic="Physics"
/>
```

## Migration Notes

- The original `CameraPreview.tsx` now re-exports the refactored component
- All existing functionality is preserved
- No breaking changes to the public API
- Internal implementation is now modular and maintainable 