# 🚀 Inicio Rápido - PostgreSQL en IONOS

## ⚡ Configuración en 3 Pasos

### 1️⃣ Instalar Dependencias
```bash
npm install
```

### 2️⃣ Inicializar Base de Datos
```bash
npm run db:init
```

Esto creará todas las tablas necesarias en PostgreSQL.

### 3️⃣ Iniciar la Aplicación
```bash
npm run dev:full
```

Esto iniciará:
- ✅ Backend API en `http://localhost:3001`
- ✅ Frontend en `http://localhost:3000`

## 🎯 Comandos Útiles

### Desarrollo
```bash
# Iniciar todo (Frontend + Backend)
npm run dev:full

# Solo backend
npm run server

# Solo frontend
npm run dev
```

### Base de Datos
```bash
# Ejecutar migraciones
npm run db:migrate

# Inicializar DB desde cero
npm run db:init
```

### Producción
```bash
# Compilar frontend
npm run build

# Vista previa de producción
npm run preview
```

## 📋 Verificar que Todo Funciona

1. **Backend API**: Visita http://localhost:3001/api/health
   - Deberías ver: `{"status":"ok","database":"connected",...}`

2. **Frontend**: Visita http://localhost:3000
   - La aplicación debería cargar normalmente

3. **Base de Datos**: Los proyectos se guardan automáticamente en PostgreSQL

## ⚙️ Configuración Actual

- **Proveedor de DB**: PostgreSQL (IONOS)
- **Host**: 74.208.125.117:5432
- **Base de Datos**: herramientascd
- **Usuario**: jhony
- **Modo**: Cliente-Servidor (Frontend → Backend API → PostgreSQL)

## 🔧 Cambiar Configuración

Para cambiar el proveedor de base de datos, edita `services/config.ts`:

```typescript
export const DB_PROVIDER: 'local' | 'firebase' | 'postgresql' = 'postgresql';
```

- `'local'` - IndexedDB del navegador (sin servidor)
- `'firebase'` - Firebase Cloud Firestore
- `'postgresql'` - PostgreSQL en IONOS (requiere backend)

## 📚 Más Información

Ver [database/DATABASE_README.md](database/DATABASE_README.md) para documentación completa.

## ⚠️ Importante

- El archivo `.env` contiene credenciales sensibles
- NO subir `.env` al repositorio
- Usar `.env.example` como plantilla para otros desarrolladores
