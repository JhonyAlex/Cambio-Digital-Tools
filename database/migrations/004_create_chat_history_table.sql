-- Migration: 004_create_chat_history_table.sql
-- Description: Creates the chat history table for AI conversations
-- Date: 2025-12-21

CREATE TABLE IF NOT EXISTS chat_history (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'model')),
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp DESC);

COMMENT ON TABLE chat_history IS 'Stores AI chat conversation history';
COMMENT ON COLUMN chat_history.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN chat_history.project_id IS 'Reference to parent project';
COMMENT ON COLUMN chat_history.role IS 'Message sender: user or model';
COMMENT ON COLUMN chat_history.text IS 'Message content';
COMMENT ON COLUMN chat_history.timestamp IS 'Timestamp in milliseconds';
