// Helper function to download and analyze WAV data
// function debugSaveWav(wavData: string, filename: string = 'debug.wav') {
//   const byteString = atob(wavData);
//   const bytes = new Uint8Array(byteString.length);
//   for (let i = 0; i < byteString.length; i++) {
//     bytes[i] = byteString.charCodeAt(i);
//   }
  
//   // Create blob and download
//   const blob = new Blob([bytes], { type: 'audio/wav' });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = filename;
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
//   URL.revokeObjectURL(url);
// }

export function pcmToWav(pcmData: string, sampleRate: number = 24000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Decode base64 PCM data
      const binaryString = atob(pcmData);
      const pcmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }

      // Convert bytes to samples (assuming 16-bit PCM)
      const samples = new Int16Array(pcmBytes.buffer);

      // Create WAV header
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);

      const pcmByteLength = samples.length * 2; // 16-bit = 2 bytes per sample

      // "RIFF" chunk descriptor
      view.setUint8(0, 'R'.charCodeAt(0));
      view.setUint8(1, 'I'.charCodeAt(0));
      view.setUint8(2, 'F'.charCodeAt(0));
      view.setUint8(3, 'F'.charCodeAt(0));

      // File length (header size + data size)
      view.setUint32(4, 36 + pcmByteLength, true);

      // "WAVE" format
      view.setUint8(8, 'W'.charCodeAt(0));
      view.setUint8(9, 'A'.charCodeAt(0));
      view.setUint8(10, 'V'.charCodeAt(0));
      view.setUint8(11, 'E'.charCodeAt(0));

      // "fmt " sub-chunk
      view.setUint8(12, 'f'.charCodeAt(0));
      view.setUint8(13, 'm'.charCodeAt(0));
      view.setUint8(14, 't'.charCodeAt(0));
      view.setUint8(15, ' '.charCodeAt(0));

      // Sub-chunk size
      view.setUint32(16, 16, true);
      // Audio format (PCM = 1)
      view.setUint16(20, 1, true);
      // Number of channels
      view.setUint16(22, 1, true);
      // Sample rate
      view.setUint32(24, sampleRate, true);
      // Byte rate
      view.setUint32(28, sampleRate * 2, true);
      // Block align
      view.setUint16(32, 2, true);
      // Bits per sample
      view.setUint16(34, 16, true);

      // "data" sub-chunk
      view.setUint8(36, 'd'.charCodeAt(0));
      view.setUint8(37, 'a'.charCodeAt(0));
      view.setUint8(38, 't'.charCodeAt(0));
      view.setUint8(39, 'a'.charCodeAt(0));

      // Data size
      view.setUint32(40, pcmByteLength, true);

      // Create final buffer
      const wavBuffer = new ArrayBuffer(wavHeader.byteLength + pcmByteLength);
      const wavBytes = new Uint8Array(wavBuffer);

      // Copy header and PCM data
      wavBytes.set(new Uint8Array(wavHeader), 0);
      wavBytes.set(new Uint8Array(samples.buffer), wavHeader.byteLength);

      // Use Blob and FileReader to convert to base64
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (base64data) {
          resolve(base64data);
        } else {
          reject(new Error("Failed to convert WAV to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

// Add this new function to convert PCM array directly to WAV array
export const pcmToWavArray = async (
  pcmBytes: Uint8Array,
  sampleRate: number = 16000
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    try {
      // PCM is 16-bit, so each sample is 2 bytes
      //const numSamples = pcmBytes.length / 2;
      
      // Create WAV header (44 bytes)
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      
      // "RIFF" chunk descriptor
      view.setUint8(0, 'R'.charCodeAt(0));
      view.setUint8(1, 'I'.charCodeAt(0));
      view.setUint8(2, 'F'.charCodeAt(0));
      view.setUint8(3, 'F'.charCodeAt(0));
      
      // Chunk size (file size - 8)
      view.setUint32(4, 36 + pcmBytes.length, true);
      
      // "WAVE" format
      view.setUint8(8, 'W'.charCodeAt(0));
      view.setUint8(9, 'A'.charCodeAt(0));
      view.setUint8(10, 'V'.charCodeAt(0));
      view.setUint8(11, 'E'.charCodeAt(0));
      
      // "fmt " sub-chunk
      view.setUint8(12, 'f'.charCodeAt(0));
      view.setUint8(13, 'm'.charCodeAt(0));
      view.setUint8(14, 't'.charCodeAt(0));
      view.setUint8(15, ' '.charCodeAt(0));
      
      // Sub-chunk size (16 for PCM)
      view.setUint32(16, 16, true);
      
      // Audio format (1 for PCM)
      view.setUint16(20, 1, true);
      
      // Number of channels (1 for mono)
      view.setUint16(22, 1, true);
      
      // Sample rate
      view.setUint32(24, sampleRate, true);
      
      // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
      view.setUint32(28, sampleRate * 2, true);
      
      // Block align (NumChannels * BitsPerSample/8)
      view.setUint16(32, 2, true);
      
      // Bits per sample
      view.setUint16(34, 16, true);
      
      // "data" sub-chunk
      view.setUint8(36, 'd'.charCodeAt(0));
      view.setUint8(37, 'a'.charCodeAt(0));
      view.setUint8(38, 't'.charCodeAt(0));
      view.setUint8(39, 'a'.charCodeAt(0));
      
      // Sub-chunk size (NumSamples * NumChannels * BitsPerSample/8)
      view.setUint32(40, pcmBytes.length, true);
      
      // Combine header and PCM data
      const wavBytes = new Uint8Array(wavHeader.byteLength + pcmBytes.length);
      wavBytes.set(new Uint8Array(wavHeader), 0);
      wavBytes.set(pcmBytes, wavHeader.byteLength);
      
      resolve(wavBytes);
    } catch (error) {
      reject(error);
    }
  });
}; 