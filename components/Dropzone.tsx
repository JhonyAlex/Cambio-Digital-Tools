
import React, { useCallback } from 'react';
import { extractDateFromFilename, extractSequenceFromFilename, detectFileType } from '../utils';
import { AudioFile } from '../types';
import { translations } from '../translations';

interface DropzoneProps {
  onFilesAdded: (newFiles: AudioFile[]) => void;
  t?: typeof translations;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded, t }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(Array.from(e.dataTransfer.files));
      }
    },
    [onFilesAdded]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    // Basic filtering to ensure we don't try to process EXEs or binaries unrelated to knowledge
    const validFiles = files.filter(f => {
       const type = f.type;
       return type.startsWith('audio/') || 
              type.startsWith('image/') || 
              type.startsWith('text/') ||
              type.includes('pdf') ||
              type.includes('json') ||
              f.name.endsWith('.opus') || f.name.endsWith('.m4a') || f.name.endsWith('.ogg');
    });

    const processedFiles: AudioFile[] = validFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        name: f.name,
        date: extractDateFromFilename(f.name),
        sequence: extractSequenceFromFilename(f.name),
        status: 'pending',
        fileType: detectFileType(f) // Detect type immediately
      }));
    
    onFilesAdded(processedFiles);
  };

  const textDrag = t ? t.dragDrop : "Arrastra tus archivos aquí";
  const subText = "Soporta Audios WhatsApp (.ogg/.opus), MP3, Imágenes y PDF";

  return (
    <div 
      className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-800 transition-all duration-300 group"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input 
        type="file" 
        id="fileInput" 
        multiple 
        accept="audio/*,image/*,application/pdf,text/*,.opus,.ogg,.m4a,.mp3,.json,.md" 
        className="hidden" 
        onChange={handleChange}
      />
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="bg-slate-700 p-4 rounded-full group-hover:bg-blue-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-medium text-slate-200">{textDrag}</p>
          <p className="text-sm text-slate-400 mt-1">{subText}</p>
        </div>
      </div>
    </div>
  );
};

export default Dropzone;
