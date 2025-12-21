import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar pool de PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // IONOS puede no requerir SSL - ajustar según sea necesario
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente PostgreSQL:', err);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// ============================================================================
// PROJECTS API
// ============================================================================

// Obtener todos los proyectos con sus archivos, chats y sesiones
app.get('/api/projects', async (req, res) => {
  try {
    const projectsResult = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC');
    
    const projects = [];
    
    for (const row of projectsResult.rows) {
      const filesResult = await pool.query(
        'SELECT * FROM files WHERE project_id = $1 ORDER BY date ASC',
        [row.id]
      );
      
      const chatResult = await pool.query(
        'SELECT * FROM chat_history WHERE project_id = $1 ORDER BY timestamp ASC',
        [row.id]
      );
      
      const sessionsResult = await pool.query(
        'SELECT * FROM sessions WHERE project_id = $1 ORDER BY created_at DESC',
        [row.id]
      );
      
      projects.push({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        globalSummary: row.global_summary,
        tags: row.tags || [],
        settings: row.settings || { autoSummarize: true, language: 'es', exportFormat: 'md' },
        schemaVersion: row.schema_version || 3,
        files: filesResult.rows.map(mapRowToFile),
        chatHistory: chatResult.rows.map(mapRowToChat),
        sessions: sessionsResult.rows.map(mapRowToSession)
      });
    }
    
    res.json(projects);
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un proyecto específico
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    
    const row = projectResult.rows[0];
    
    const filesResult = await pool.query(
      'SELECT * FROM files WHERE project_id = $1 ORDER BY date ASC',
      [id]
    );
    
    const chatResult = await pool.query(
      'SELECT * FROM chat_history WHERE project_id = $1 ORDER BY timestamp ASC',
      [id]
    );
    
    const sessionsResult = await pool.query(
      'SELECT * FROM sessions WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    const project = {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      globalSummary: row.global_summary,
      tags: row.tags || [],
      settings: row.settings || { autoSummarize: true, language: 'es', exportFormat: 'md' },
      schemaVersion: row.schema_version || 3,
      files: filesResult.rows.map(mapRowToFile),
      chatHistory: chatResult.rows.map(mapRowToChat),
      sessions: sessionsResult.rows.map(mapRowToSession)
    };
    
    res.json(project);
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo proyecto
app.post('/api/projects', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name } = req.body;
    
    const newProject = {
      id: crypto.randomUUID(),
      name: name?.trim() || 'Nuevo Proyecto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: [],
      chatHistory: [],
      tags: [],
      settings: { autoSummarize: true, language: 'es', exportFormat: 'md' },
      schemaVersion: 3,
      sessions: []
    };
    
    await client.query(`
      INSERT INTO projects (id, name, created_at, updated_at, global_summary, tags, settings, schema_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      newProject.id,
      newProject.name,
      newProject.createdAt,
      newProject.updatedAt,
      null,
      newProject.tags,
      JSON.stringify(newProject.settings),
      newProject.schemaVersion
    ]);
    
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Actualizar un proyecto
app.put('/api/projects/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const project = req.body;
    
    // Actualizar proyecto
    await client.query(`
      UPDATE projects SET
        name = $2,
        updated_at = $3,
        global_summary = $4,
        tags = $5,
        settings = $6,
        schema_version = $7
      WHERE id = $1
    `, [
      id,
      project.name,
      Date.now(),
      project.globalSummary || null,
      project.tags || [],
      JSON.stringify(project.settings || {}),
      project.schemaVersion || 3
    ]);
    
    // Eliminar archivos existentes y re-insertar
    await client.query('DELETE FROM files WHERE project_id = $1', [id]);
    if (project.files) {
      for (const file of project.files) {
        await client.query(`
          INSERT INTO files (id, project_id, session_id, name, date, sequence, status, transcript, summary, speaker, error_msg, file_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          file.id,
          id,
          file.sessionId || null,
          file.name,
          file.date,
          file.sequence,
          file.status,
          file.transcript || null,
          file.summary || null,
          file.speaker || null,
          file.errorMsg || null,
          file.fileType
        ]);
      }
    }
    
    // Eliminar chat history y re-insertar
    await client.query('DELETE FROM chat_history WHERE project_id = $1', [id]);
    if (project.chatHistory) {
      for (const chat of project.chatHistory) {
        await client.query(`
          INSERT INTO chat_history (id, project_id, role, text, timestamp)
          VALUES ($1, $2, $3, $4, $5)
        `, [chat.id, id, chat.role, chat.text, chat.timestamp]);
      }
    }
    
    // Eliminar sesiones y re-insertar
    await client.query('DELETE FROM sessions WHERE project_id = $1', [id]);
    if (project.sessions) {
      for (const session of project.sessions) {
        await client.query(`
          INSERT INTO sessions (id, project_id, name, description, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [session.id, id, session.name, session.description || null, session.createdAt]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Proyecto actualizado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Eliminar un proyecto
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ success: true, message: 'Proyecto eliminado' });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function mapRowToFile(row) {
  return {
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    sequence: row.sequence,
    status: row.status,
    transcript: row.transcript,
    summary: row.summary,
    speaker: row.speaker,
    errorMsg: row.error_msg,
    sessionId: row.session_id,
    fileType: row.file_type
  };
}

function mapRowToChat(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    timestamp: row.timestamp
  };
}

function mapRowToSession(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at
  };
}

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: PostgreSQL en IONOS`);
  console.log(`🔧 Endpoints disponibles:`);
  console.log(`   GET    /api/health`);
  console.log(`   GET    /api/projects`);
  console.log(`   GET    /api/projects/:id`);
  console.log(`   POST   /api/projects`);
  console.log(`   PUT    /api/projects/:id`);
  console.log(`   DELETE /api/projects/:id`);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n⏹️ Cerrando servidor...');
  await pool.end();
  process.exit(0);
});

export default app;
