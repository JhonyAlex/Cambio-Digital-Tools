-- Migration: 003_create_files_table.sql
-- Description: Creates the files table for storing audio, images, documents, and text files
-- Date: 2025-12-21

CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  name VARCHAR(500) NOT NULL,
  date TIMESTAMP NOT NULL,
  sequence INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  transcript TEXT,
  summary TEXT,
  speaker VARCHAR(255),
  error_msg TEXT,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('audio', 'image', 'document', 'text'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_session_id ON files(session_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_date ON files(date DESC);

COMMENT ON TABLE files IS 'Stores file metadata and processing results';
COMMENT ON COLUMN files.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN files.project_id IS 'Reference to parent project';
COMMENT ON COLUMN files.session_id IS 'Optional reference to session';
COMMENT ON COLUMN files.name IS 'Original file name';
COMMENT ON COLUMN files.date IS 'File date/timestamp';
COMMENT ON COLUMN files.sequence IS 'WhatsApp sequence number (WAxxxx)';
COMMENT ON COLUMN files.status IS 'Processing status: pending, processing, completed, error';
COMMENT ON COLUMN files.transcript IS 'Transcription or OCR text';
COMMENT ON COLUMN files.summary IS 'AI-generated summary';
COMMENT ON COLUMN files.speaker IS 'Speaker identification (for audio)';
COMMENT ON COLUMN files.error_msg IS 'Error message if status is error';
COMMENT ON COLUMN files.file_type IS 'Type of file: audio, image, document, text';
