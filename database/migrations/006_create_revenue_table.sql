-- Migration: 006_create_revenue_table.sql
-- Description: Creates the revenue tracking table
-- Date: 2025-12-21

CREATE TABLE IF NOT EXISTS revenue_records (
  id VARCHAR(255) PRIMARY KEY,
  client_name VARCHAR(500) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('paid', 'pending', 'process')),
  employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE SET NULL,
  estimated_date BIGINT NOT NULL,
  description TEXT,
  created_at BIGINT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_revenue_records_employee_id ON revenue_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_status ON revenue_records(status);
CREATE INDEX IF NOT EXISTS idx_revenue_records_estimated_date ON revenue_records(estimated_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_records_created_at ON revenue_records(created_at DESC);

COMMENT ON TABLE revenue_records IS 'Stores revenue/income tracking records';
COMMENT ON COLUMN revenue_records.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN revenue_records.client_name IS 'Name of the client';
COMMENT ON COLUMN revenue_records.amount IS 'Revenue amount in COP';
COMMENT ON COLUMN revenue_records.status IS 'Payment status: paid, pending, or process';
COMMENT ON COLUMN revenue_records.employee_id IS 'Associated employee (optional)';
COMMENT ON COLUMN revenue_records.estimated_date IS 'Estimated payment date (timestamp in milliseconds)';
COMMENT ON COLUMN revenue_records.description IS 'Optional description';
COMMENT ON COLUMN revenue_records.created_at IS 'Record creation timestamp';
