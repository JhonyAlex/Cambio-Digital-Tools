-- Migration: 005_create_payroll_tables.sql
-- Description: Creates tables for payroll management
-- Date: 2025-12-21

-- Payroll Configuration Table
CREATE TABLE IF NOT EXISTS payroll_config (
  id SERIAL PRIMARY KEY,
  base_salary NUMERIC(15, 2) NOT NULL,
  total_budget NUMERIC(15, 2) NOT NULL,
  euro_exchange_rate NUMERIC(10, 4) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

COMMENT ON TABLE payroll_config IS 'Stores global payroll configuration';
COMMENT ON COLUMN payroll_config.base_salary IS 'Base salary in COP';
COMMENT ON COLUMN payroll_config.total_budget IS 'Total payroll budget in COP';
COMMENT ON COLUMN payroll_config.euro_exchange_rate IS 'EUR to COP exchange rate';

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  multiplier NUMERIC(5, 2) NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

COMMENT ON TABLE roles IS 'Stores employee role definitions';
COMMENT ON COLUMN roles.name IS 'Role name (unique)';
COMMENT ON COLUMN roles.multiplier IS 'Salary multiplier for this role';

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(500) NOT NULL,
  role VARCHAR(255) NOT NULL,
  bonus NUMERIC(15, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  joined_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

COMMENT ON TABLE employees IS 'Stores employee information';
COMMENT ON COLUMN employees.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN employees.full_name IS 'Employee full name';
COMMENT ON COLUMN employees.role IS 'Employee role (references role name)';
COMMENT ON COLUMN employees.bonus IS 'Free edition bonus in COP';
COMMENT ON COLUMN employees.active IS 'Whether employee is currently active';
COMMENT ON COLUMN employees.joined_at IS 'Timestamp when employee joined';

-- Payment Records Table
CREATE TABLE IF NOT EXISTS payment_records (
  id VARCHAR(255) PRIMARY KEY,
  date BIGINT NOT NULL,
  employee_id VARCHAR(255) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name VARCHAR(500) NOT NULL,
  role VARCHAR(255) NOT NULL,
  base_salary NUMERIC(15, 2) NOT NULL,
  role_multiplier NUMERIC(5, 2) NOT NULL,
  calculated_salary NUMERIC(15, 2) NOT NULL,
  christmas_bonus NUMERIC(15, 2) NOT NULL,
  extra_bonus NUMERIC(15, 2) NOT NULL,
  total_paid NUMERIC(15, 2) NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_records_employee_id ON payment_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON payment_records(date DESC);

COMMENT ON TABLE payment_records IS 'Stores individual payment records';
COMMENT ON COLUMN payment_records.date IS 'Payment date (timestamp in milliseconds)';
COMMENT ON COLUMN payment_records.employee_id IS 'Reference to employee';
COMMENT ON COLUMN payment_records.calculated_salary IS 'Base salary * multiplier';
COMMENT ON COLUMN payment_records.christmas_bonus IS 'Christmas bonus amount';
COMMENT ON COLUMN payment_records.extra_bonus IS 'Additional bonus amount';
COMMENT ON COLUMN payment_records.total_paid IS 'Total amount paid';
