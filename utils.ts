
import { AudioFile, TimelineGroup, FileType } from './types';

// Helper to extract date from WhatsApp filenames
// Patterns: PTT-20231027-WA0001.opus, AUD-20231027-WA0001.m4a, IMG-2023..., DOC-2023...
export const extractDateFromFilename = (filename: string): Date => {
  const regex = /(\d{8})/; // Matches YYYYMMDD
  const match = filename.match(regex);

  if (match && match[1]) {
    const dateStr = match[1];
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }

  // Fallback to file modification date if parsing fails, or now
  return new Date();
};

// Helper to extract sequence number from WhatsApp filenames (e.g., WA0006 -> 6)
export const extractSequenceFromFilename = (filename: string): number => {
  // Looks for -WA followed by digits
  const regex = /-WA(\d+)/i;
  const match = filename.match(regex);
  
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0; // Default sequence if not found
};

export const groupFilesByDate = (
  files: AudioFile[], 
  dateOrder: 'asc' | 'desc' = 'desc', 
  seqOrder: 'asc' | 'desc' = 'asc'
): TimelineGroup[] => {
  const groups: { [key: string]: AudioFile[] } = {};

  files.forEach((file) => {
    const dateKey = file.date.toISOString().split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(file);
  });

  const sortedGroups: TimelineGroup[] = Object.keys(groups)
    .map((dateStr) => ({
      dateStr,
      dateObj: new Date(dateStr),
      items: groups[dateStr].sort((a, b) => {
        // Sort by sequence number first
        if (a.sequence !== b.sequence) {
          return seqOrder === 'asc' ? a.sequence - b.sequence : b.sequence - a.sequence;
        }
        // Fallback to name if sequences are equal (rare in same day)
        return seqOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }),
    }))
    .sort((a, b) => {
      const timeA = a.dateObj.getTime();
      const timeB = b.dateObj.getTime();
      return dateOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

  return sortedGroups;
};

// Robust mime-type detection for Gemini API Compatibility
const getMimeType = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  // Explicit mapping for Audio to ensure Gemini compatibility
  // Browser detection can sometimes be generic (e.g. audio/x-m4a), which APIs might reject causing Error 400
  switch (ext) {
    // Audio
    case 'opus': return 'audio/ogg'; 
    case 'ogg': return 'audio/ogg';
    case 'mp3': return 'audio/mpeg'; // Important: Use mpeg, not mp3
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4'; // Important: Use mp4 for m4a container
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    case 'wma': return 'audio/wma';
    case 'amr': return 'audio/amr';
    // Images
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    // Documents
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'md': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'json': return 'application/json';
  }

  // Fallback to browser detection if extension not in list
  if (file.type && file.type !== '') return file.type;

  return 'application/octet-stream'; 
};

export const detectFileType = (file: File): FileType => {
  const mime = getMimeType(file);
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) return 'text';
  if (mime.includes('pdf')) return 'document';
  return 'document'; // Default fallback
};

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // Add a timeout to prevent hanging indefinitely
    const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error("Timeout reading file."));
    }, 30000); // 30s timeout (increased for larger files)

    reader.onloadend = () => {
      clearTimeout(timeout);
      const base64String = reader.result as string;
      if (!base64String) {
          reject(new Error("Failed to read file content"));
          return;
      }
      
      // Extract pure Base64 (remove data:image/png;base64, prefix)
      const base64Content = base64String.split(',')[1];
      
      resolve({
        inlineData: {
          data: base64Content,
          // Use our strict mime type detector instead of file.type to avoid API errors
          mimeType: getMimeType(file),
        },
      });
    };
    
    reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Error reading file"));
    };
    
    reader.readAsDataURL(file);
  });
};

export const readFileAsText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

// --- AUDIO CONVERSION UTILITIES ---

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts any browser-supported audio file (OGG, Opus, WebM) to WAV (PCM 16-bit).
 * This solves compatibility issues with Gemini API for WhatsApp audios.
 */
export const convertAudioToWav = async (file: File): Promise<File> => {
  // Use standard AudioContext (available in modern browsers)
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) throw new Error("Web Audio API not supported in this browser");
  
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  
  // Native decoding (Browser handles OGG/Opus decoding internally)
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Encode to WAV (16-bit PCM)
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  
  let pos = 0;
  
  // RIFF chunk descriptor
  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, length - 8, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;
  
  // fmt sub-chunk
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(pos, 1, true); pos += 2; // AudioFormat (1 for PCM)
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, audioBuffer.sampleRate, true); pos += 4;
  view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChan, true); pos += 4; // ByteRate
  view.setUint16(pos, numOfChan * 2, true); pos += 2; // BlockAlign
  view.setUint16(pos, 16, true); pos += 2; // BitsPerSample
  
  // data sub-chunk
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, length - pos - 4, true); pos += 4;
  
  // Interleave and Write PCM data
  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
      channels.push(audioBuffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numOfChan; ch++) {
          let sample = channels[ch][i];
          // Clip to [-1, 1]
          sample = Math.max(-1, Math.min(1, sample));
          // Scale to 16-bit integer
          sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, sample, true);
          offset += 2;
      }
  }
  
  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  const newName = file.name.replace(/\.[^/.]+$/, "") + ".wav";
  
  return new File([wavBlob], newName, { type: 'audio/wav' });
};
