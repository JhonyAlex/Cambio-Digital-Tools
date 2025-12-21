-- Migration: 001_create_projects_table.sql
-- Description: Creates the projects table with all necessary fields
-- Date: 2025-12-21

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  global_summary TEXT,
  tags TEXT[],
  settings JSONB DEFAULT '{"autoSummarize": true, "language": "es", "exportFormat": "md"}'::jsonb,
  schema_version INTEGER DEFAULT 3
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

COMMENT ON TABLE projects IS 'Stores project information for Cambio Digital Tools';
COMMENT ON COLUMN projects.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN projects.name IS 'Project name';
COMMENT ON COLUMN projects.created_at IS 'Timestamp in milliseconds';
COMMENT ON COLUMN projects.updated_at IS 'Timestamp in milliseconds';
COMMENT ON COLUMN projects.global_summary IS 'AI-generated summary of the project';
COMMENT ON COLUMN projects.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN projects.settings IS 'JSON object with project settings';
COMMENT ON COLUMN projects.schema_version IS 'Schema version for migrations';
