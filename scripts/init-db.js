#!/usr/bin/env node

/**
 * Script de inicialización de la base de datos PostgreSQL
 * Ejecuta todas las migraciones necesarias para crear la estructura de tablas
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de conexión desde variables de entorno
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://jhony:vcDDw5QiFT7G@74.208.125.117:5432/herramientascd';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // Intentar sin SSL primero
  ssl: false
});

async function runMigrations() {
  console.log('🚀 Iniciando migraciones de base de datos...\n');
  
  const client = await pool.connect();
  
  try {
    // Probar conexión
    console.log('📡 Probando conexión a PostgreSQL...');
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Conexión exitosa:', testResult.rows[0].now);
    console.log('');
    
    // Obtener lista de archivos de migración
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`📂 Encontradas ${files.length} migraciones:\n`);
    
    for (const file of files) {
      console.log(`  🔄 Ejecutando: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`  ✅ Completada: ${file}\n`);
      } catch (error) {
        console.error(`  ❌ Error en ${file}:`, error.message);
        throw error;
      }
    }
    
    console.log('🎉 ¡Todas las migraciones se ejecutaron exitosamente!\n');
    
    // Verificar las tablas creadas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📊 Tablas creadas:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error durante las migraciones:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log('\n✨ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
