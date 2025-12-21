# Configuración de Base de Datos PostgreSQL

Esta aplicación está configurada para usar PostgreSQL hospedado en IONOS como base de datos principal.

## 📋 Requisitos Previos

- Node.js 18 o superior
- Acceso a la base de datos PostgreSQL en IONOS
- Variables de entorno configuradas correctamente

## 🔧 Configuración Inicial

### 1. Configurar Variables de Entorno

El archivo `.env` ya está configurado con las credenciales de conexión y la URL de la API:

```env
# PostgreSQL Database Configuration - IONOS
VITE_DB_HOST=74.208.125.117
VITE_DB_PORT=5432
VITE_DB_NAME=herramientascd
VITE_DB_USER=jhony
VITE_DB_PASSWORD=vcDDw5QiFT7G
VITE_DATABASE_URL=postgresql://jhony:vcDDw5QiFT7G@74.208.125.117:5432/herramientascd

# API Backend Configuration
VITE_API_URL=http://localhost:3001/api

# Legacy support (for server-side)
DATABASE_URL=postgresql://jhony:vcDDw5QiFT7G@74.208.125.117:5432/herramientascd
```

### 2. Instalar Dependencias

```bash
npm install
```

Esto instalará:
- `pg` - Cliente de PostgreSQL para Node.js
- `@types/pg` - Tipos TypeScript para pg
- `express` - Framework web para el servidor API
- `cors` - Middleware para habilitar CORS
- `dotenv` - Carga variables de entorno
- `concurrently` - Ejecuta múltiples comandos simultáneamente

### 3. Inicializar la Base de Datos

Ejecuta el script de migración para crear todas las tablas necesarias:

```bash
npm run db:init
```

Este comando ejecutará todas las migraciones en orden:
1. `001_create_projects_table.sql` - Tabla de proyectos
2. `002_create_sessions_table.sql` - Tabla de sesiones
3. `003_create_files_table.sql` - Tabla de archivos
4. `004_create_chat_history_table.sql` - Tabla de historial de chat
5. `005_create_payroll_tables.sql` - Tablas de nómina
6. `006_create_revenue_table.sql` - Tabla de ingresos

### 4. Verificar la Conexión

El script de migración verificará automáticamente la conexión. Deberías ver:

```
✅ Conexión exitosa
✅ Todas las migraciones se ejecutaron exitosamente
📊 Tablas creadas:
  - projects
  - sessions
  - files
  - chat_history
  - payroll_config
  - roles
  - employees
  - payment_records
  - revenue_records
```

## 🗄️ Estructura de la Base de Datos

### Tabla: `projects`
- **Descripción**: Almacena información de proyectos
- **Campos principales**:
  - `id` (VARCHAR) - Identificador único (UUID)
  - `name` (VARCHAR) - Nombre del proyecto
  - `created_at` (BIGINT) - Timestamp de creación
  - `updated_at` (BIGINT) - Timestamp de última actualización
  - `settings` (JSONB) - Configuraciones del proyecto

### Tabla: `files`
- **Descripción**: Almacena archivos y sus transcripciones/análisis
- **Tipos de archivo**: audio, image, document, text
- **Estados**: pending, processing, completed, error

### Tabla: `employees`
- **Descripción**: Información de empleados para nómina
- **Vinculada con**: `payment_records`, `revenue_records`

### Tabla: `revenue_records`
- **Descripción**: Registro de ingresos y facturación
- **Arquitectura Cliente-Servidor

La aplicación utiliza una arquitectura de tres capas:

1. **Frontend (React + Vite)** - Puerto 3000
   - Interfaz de usuario en el navegador
   - Se comunica con el backend vía API REST

2. **Backend (Express + Node.js)** - Puerto 3001
   - Servidor API que maneja las peticiones
   - Conexión directa con PostgreSQL
   - Ubicado en `server/index.js`

3. **Base de Datos (PostgreSQL)** - IONOS
   - Almacenamiento persistente en la nube
   - Puerto 5432

### Iniciar la Aplicación Completa

Para ejecutar tanto el frontend como el backend simultáneamente:

```bash
npm run dev:full
```

O ejecutar cada servicio por separado:

```bash
# Terminal 1 - Backend API
npm run server

# Terminal 2 - Frontend Vite
npm run dev
```

### Estados**: paid, pending, process

## 🚀 Modo de Operación

### Cambiar Proveedor de Base de Datos

Edita [services/config.ts](../services/config.ts):

```typescript
export const DB_PROVIDER: 'local' | 'firebase' | 'postgresql' = 'postgresql';
```

Opciones disponibles:
- `'local'` - IndexedDB del navegador (sin persistencia en nube)
- `'firebase'` - Firebase Cloud Firestore
- `'postgresql'` - PostgreSQL remoto (IONOS) ✅ **ACTUAL**

## 🔄 Migraciones

Las migraciones SQL se encuentran en `database/migrations/`. Son idempotentes (se pueden ejecutar múltiples veces sin problemas gracias al uso de `CREATE TABLE IF NOT EXISTS`).

Para ejecutar las migraciones:

```bash
npm run db:migrate
```

## 🛠️ Desarrollo

### Conectar desde el Código

La aplicación usa el adaptador `APIAdapter` que se comunica con el backend Express.

```typescript
import { getProjects, saveProject } from './services/storageService';

// Obtener todos los proyectos
const projects = await getProjects();

// Guardar un proyecto
await saveProject(myProject);
```

El backend en `server/index.js` maneja las conexiones a PostgreSQL y expone los siguientes endpoints:

- `GET /api/health` - Verificar estado de la conexión
- `GET /api/projects` - Obtener todos los proyectos
- `GET /api/projects/:id` - Obtener un proyecto específico
- `POST /api/projects` - Crear un nuevo proyecto
- `PUT /api/projects/:id` - Actualizar un proyecto
- `DELETE /api/projects/:id` - Eliminar un proyecto

### Pool de Conexiones

El servicio de base de datos mantiene un pool de conexiones configurado en `server/index.js`:

- **Conexiones máximas**: 20
- **Timeout de inactividad**: 30 segundos
- **Timeout de conexión**: 10 segundos
- **SSL**: Habilitado (requerido para IONOS)

## 📊 Monitoreo

Para verificar el estado de las tablas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Para ver el número de registros en cada tabla:

```sql
SELECT 
  'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'files', COUNT(*) FROM files
UNION ALL
SELECT 'employees', COUNT(*) FROM employees;
```

## 🔒 Seguridad

⚠️ **IMPORTANTE**: 
- El archivo `.env` contiene credenciales sensibles y NO debe ser incluido en el control de versiones
- `.env` está agregado al `.gitignore`
- Usa `.env.example` como plantilla para otros desarrolladores

## 🐛 Troubleshooting

### Error: "Connection refused" o "ECONNREFUSED"
- Verifica que el backend esté ejecutándose: `npm run server`
- Confirma que las credenciales en `.env` sean correctas
- Verifica que el servidor PostgreSQL en IONOS esté accesible
- Revisa el firewall y reglas de acceso en IONOS

### Error: "Failed to fetch" en el frontend
- Asegúrate de que el backend esté corriendo en el puerto 3001
- Verifica que VITE_API_URL en `.env` sea `http://localhost:3001/api`
- Confirma que CORS esté habilitado en el servidor

### Error: "relation does not exist"
- Ejecuta las migraciones: `npm run db:init`
- Verifica que todas las migraciones se completaron exitosamente

### Error: "SSL required"
- El SSL está habilitado por defecto en la configuración del servidor
- IONOS requiere SSL para conexiones remotas

### Error: Backend no inicia
- Verifica que las dependencias estén instaladas: `npm install`
- Confirma que la variable DATABASE_URL esté correctamente configurada
- Revisa los logs del servidor para más detalles

## 📚 Referencias

- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [node-postgres (pg)](https://node-postgres.com/)
- [IONOS Database Hosting](https://www.ionos.com/hosting/postgresql-hosting)

---

**Última actualización**: 21 de diciembre de 2025
