-- Migration: 002_create_sessions_table.sql
-- Description: Creates the sessions table linked to projects
-- Date: 2025-12-21

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  created_at BIGINT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

COMMENT ON TABLE sessions IS 'Stores session information within projects';
COMMENT ON COLUMN sessions.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN sessions.project_id IS 'Reference to parent project';
COMMENT ON COLUMN sessions.name IS 'Session name';
COMMENT ON COLUMN sessions.description IS 'Optional session description';
COMMENT ON COLUMN sessions.created_at IS 'Timestamp in milliseconds';
