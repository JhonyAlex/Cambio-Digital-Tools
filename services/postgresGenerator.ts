
import { POSTGRES_CONFIG } from './config';
import { getProjects } from './storageService';
import { payrollService } from './payrollService';
import { revenueService } from './revenueService';

/**
 * SERVICE: Postgres Generator
 * Generates SQL scripts to sync Local/Firebase state to the IONOS Postgres DB.
 * Supports Postgres 17 syntax.
 */

export const generateMigrationScript = async (): Promise<string> => {
  // 1. Fetch all data
  const projects = await getProjects();
  const employees = await payrollService.getEmployees();
  const payrollConfig = await payrollService.getConfig();
  const revenues = await revenueService.getRevenues();

  const timestamp = new Date().toISOString();

  let sql = `-- MIGRATION SCRIPT FOR IONOS POSTGRESQL (Generated: ${timestamp})
-- DB: ${POSTGRES_CONFIG.database}
-- HOST: ${POSTGRES_CONFIG.host}

BEGIN;

-- 1. CLEANUP (Optional - be careful in production)
-- DROP TABLE IF EXISTS revenue_records CASCADE;
-- DROP TABLE IF EXISTS payment_history CASCADE;
-- DROP TABLE IF EXISTS employees CASCADE;
-- DROP TABLE IF EXISTS audio_files CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS projects CASCADE;

-- 2. SCHEMA DEFINITION

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at BIGINT,
    updated_at BIGINT,
    global_summary TEXT,
    settings JSONB
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at BIGINT
);

CREATE TABLE IF NOT EXISTS audio_files (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    session_id UUID, -- Nullable (Inbox)
    name TEXT NOT NULL,
    date TIMESTAMP,
    sequence INT,
    status TEXT,
    transcript TEXT,
    summary TEXT,
    file_type TEXT
);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    bonus NUMERIC(10, 2),
    active BOOLEAN DEFAULT TRUE,
    joined_at BIGINT
);

CREATE TABLE IF NOT EXISTS revenue_records (
    id UUID PRIMARY KEY,
    client_name TEXT NOT NULL,
    amount NUMERIC(15, 2),
    status TEXT CHECK (status IN ('paid', 'pending', 'process')),
    employee_id UUID, -- Soft link to employees
    estimated_date BIGINT,
    description TEXT,
    created_at BIGINT
);

-- 3. DATA INJECTION

`;

  // PROJECTS
  for (const p of projects) {
    const safeName = p.name.replace(/'/g, "''");
    const safeSummary = (p.globalSummary || '').replace(/'/g, "''");
    const settingsJson = JSON.stringify(p.settings || {}).replace(/'/g, "''");
    
    sql += `INSERT INTO projects (id, name, created_at, updated_at, global_summary, settings) 
            VALUES ('${p.id}', '${safeName}', ${p.createdAt}, ${p.updatedAt}, '${safeSummary}', '${settingsJson}')
            ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name, 
            updated_at = EXCLUDED.updated_at,
            global_summary = EXCLUDED.global_summary;\n`;

    // SESSIONS
    if (p.sessions) {
        for (const s of p.sessions) {
            const safeSName = s.name.replace(/'/g, "''");
            sql += `INSERT INTO sessions (id, project_id, name, created_at)
                    VALUES ('${s.id}', '${p.id}', '${safeSName}', ${s.createdAt})
                    ON CONFLICT (id) DO NOTHING;\n`;
        }
    }

    // FILES
    for (const f of p.files) {
        const safeFName = f.name.replace(/'/g, "''");
        const safeTrans = (f.transcript || '').replace(/'/g, "''");
        const safeSum = (f.summary || '').replace(/'/g, "''");
        const sessId = f.sessionId ? `'${f.sessionId}'` : 'NULL';
        const dateIso = f.date instanceof Date ? f.date.toISOString() : new Date(f.date).toISOString();

        sql += `INSERT INTO audio_files (id, project_id, session_id, name, date, sequence, status, transcript, summary, file_type)
                VALUES ('${f.id}', '${p.id}', ${sessId}, '${safeFName}', '${dateIso}', ${f.sequence || 0}, '${f.status}', '${safeTrans}', '${safeSum}', '${f.fileType}')
                ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                transcript = EXCLUDED.transcript,
                summary = EXCLUDED.summary;\n`;
    }
  }

  // EMPLOYEES
  for (const e of employees) {
      const safeName = e.fullName.replace(/'/g, "''");
      sql += `INSERT INTO employees (id, full_name, role, bonus, active, joined_at)
              VALUES ('${e.id}', '${safeName}', '${e.role}', ${e.bonus}, ${e.active}, ${e.joinedAt})
              ON CONFLICT (id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              role = EXCLUDED.role,
              active = EXCLUDED.active,
              bonus = EXCLUDED.bonus;\n`;
  }

  // REVENUES
  for (const r of revenues) {
      const safeClient = r.clientName.replace(/'/g, "''");
      const safeDesc = (r.description || '').replace(/'/g, "''");
      const empId = r.employeeId ? `'${r.employeeId}'` : 'NULL';
      
      sql += `INSERT INTO revenue_records (id, client_name, amount, status, employee_id, estimated_date, description, created_at)
              VALUES ('${r.id}', '${safeClient}', ${r.amount}, '${r.status}', ${empId}, ${r.estimatedDate}, '${safeDesc}', ${r.createdAt})
              ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              amount = EXCLUDED.amount;\n`;
  }

  sql += `\nCOMMIT;`;
  return sql;
};

export const downloadSqlFile = (content: string, filename: string = 'backup_ionos.sql') => {
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
