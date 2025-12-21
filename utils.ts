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

// Robust mime-type detection
const getMimeType = (file: File): string => {
  // Trust the browser if valid
  if (file.type && file.type !== '') return file.type;

  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    // Audio
    case 'opus': return 'audio/ogg'; 
    case 'ogg': return 'audio/ogg';
    case 'mp3': return 'audio/mp3';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
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
    default: return 'application/octet-stream'; 
  }
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
    }, 20000); // 20s timeout (increased for larger files like PDFs)

    reader.onloadend = () => {
      clearTimeout(timeout);
      const base64String = reader.result as string;
      if (!base64String) {
          reject(new Error("Failed to read file content"));
          return;
      }
      
      const base64Content = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
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