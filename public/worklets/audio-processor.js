/**
 * AudioWorkletProcessor for real-time audio processing
 * This worklet runs in a separate thread and processes audio data from the microphone
 * It converts float32 audio samples to 16-bit PCM format and calculates audio levels
 */

// Note: AudioWorkletProcessor is available in the worklet scope
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Buffer size for accumulating samples before processing
    // Smaller buffer = lower latency but more frequent processing
    
    // Reference: At 16kHz sample rate:
    // 256 samples = 16ms latency
    // 512 samples = 32ms latency  
    // 1024 samples = 64ms latency
    // 2048 samples = 128ms latency
    this.bufferSize = 256;  // Much smaller for maximum responsiveness
    
    // Buffer to accumulate incoming audio samples
    this.accumulatedSamples = new Float32Array(this.bufferSize);
    
    // Counter to track how many samples we've accumulated
    this.sampleCount = 0;
  }

  /**
   * Main processing function called by the audio system
   * @param {Array} inputs - Array of input audio channels
   * @param {Array} outputs - Array of output audio channels (not used in this processor)
   * @param {Object} parameters - Audio parameters (not used in this processor)
   * @returns {boolean} - true to keep the processor alive
   */
  process(inputs, outputs, parameters) {
    // Get the first input channel (mono audio)
    const input = inputs[0][0];
    if (!input) {
      return true;
    }

    // Accumulate incoming samples into our buffer
    for (let i = 0; i < input.length && this.sampleCount < this.bufferSize; i++) {
      this.accumulatedSamples[this.sampleCount++] = input[i];
    }

    // Process when we have enough samples to fill our buffer
    if (this.sampleCount >= this.bufferSize) {
      // Create 16-bit PCM array for output
      const pcm16 = new Int16Array(this.bufferSize);
      let sum = 0;
      
      // Convert float32 samples to 16-bit PCM format
      // Simple conversion like in the original implementation
      for (let i = 0; i < this.bufferSize; i++) {
        // Scale float32 values (-1 to 1) to 16-bit range (-32768 to 32767)
        // 0x7FFF = 32767 (maximum positive 16-bit value)
        pcm16[i] = this.accumulatedSamples[i] * 0x7FFF;
        
        // Calculate sum of absolute values for level detection
        sum += Math.abs(pcm16[i]);
      }

      // Create ArrayBuffer for efficient data transfer
      // 2 bytes per sample (16-bit)
      const buffer = new ArrayBuffer(this.bufferSize * 2);
      const view = new DataView(buffer);
      
      // Write PCM data to buffer in little-endian format
      pcm16.forEach((value, index) => {
        view.setInt16(index * 2, value, true); // true = little-endian
      });

      // Calculate audio level as percentage
      // Normalize by dividing by (bufferSize * maxValue) then multiply by 100
      const level = (sum / (this.bufferSize * 0x7FFF)) * 100;

      // Send processed data back to main thread
      // [buffer] transfers ownership of the buffer (zero-copy transfer)
      this.port.postMessage({
        pcmData: buffer,  // 16-bit PCM audio data
        level: Math.min(level * 5, 100)  // Amplify level and cap at 100%
      }, [buffer]);

      // Reset sample counter for next batch
      this.sampleCount = 0;
    }

    return true; // Keep the processor alive
  }
}

// Register this processor with the audio worklet system
// 'audio-processor' is the name that will be used to instantiate this processor
registerProcessor('audio-processor', AudioProcessor); 