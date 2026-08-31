import * as XLSX from 'xlsx';
import { 
  MaintenanceFieldKey, 
  MaintenanceFieldDefinition, 
  MaintenanceColumnMapping, 
  ColumnMappingPreference, 
  MaintenanceRow, 
  MaintenanceStats, 
  WorkerStat, 
  TypeStat, 
  AssetStat, 
  MaintenanceReportRecord 
} from '../types';

// ── 1. DEFINICIÓN DE CAMPOS ESTÁNDAR Y SINÓNIMOS ───────────────────

export const MAINTENANCE_FIELDS: MaintenanceFieldDefinition[] = [
  {
    key: 'ot',
    label: 'Nº Orden de Trabajo (OT)',
    required: true,
    description: 'Código o número identificador de la Orden de Trabajo.',
    synonyms: ['ot', 'orden', 'orden de trabajo', 'nº ot', 'num ot', 'numero ot', 'nro ot', 'work order', 'wo', 'id ot', 'orden trabajo']
  },
  {
    key: 'trabajador',
    label: 'Trabajador / Técnico',
    required: true,
    description: 'Nombre o código del técnico/operario que ejecutó la labor.',
    synonyms: ['trabajador', 'tecnico', 'técnico', 'operario', 'empleado', 'responsable', 'nombre', 'recurso', 'worker', 'technician', 'ejecutor', 'persona']
  },
  {
    key: 'fechaInicio',
    label: 'Fecha de Inicio',
    required: true,
    description: 'Fecha en la que comenzó el trabajo o registro de mano de obra.',
    synonyms: ['fecha inicio', 'fecha de inicio', 'fecha', 'f. inicio', 'inicio', 'fecha desde', 'start date', 'fecha_inicio', 'f_inicio', 'fechainicio', 'fecha_trabajo', 'fecha trabajo']
  },
  {
    key: 'tiempoTotal',
    label: 'Tiempo / Horas Dedicadas',
    required: true,
    description: 'Duración total de la labor (HH:mm, horas decimales o minutos).',
    synonyms: ['tiempo total', 'tiempo', 'horas', 'duracion', 'duración', 'tiempo_total', 'horas totales', 'total time', 'hours', 'tiempo invertido', 'horas hombre', 'hh', 'tiempototal', 'tiempo trabajado']
  },
  {
    key: 'tipoOT',
    label: 'Tipo de OT',
    required: false,
    description: 'Clasificación del mantenimiento (ej: Preventivo, Correctivo, Predictivo, Avería).',
    synonyms: ['tipo ot', 'tipo de ot', 'tipo', 'clase ot', 'tipo orden', 'order type', 'tipo_ot', 'clase de ot', 'tipoot', 'clasificacion', 'tipo mantenimiento']
  },
  {
    key: 'activo',
    label: 'Activo / Equipo',
    required: false,
    description: 'Código, TAG o nombre del equipo o máquina intervenida.',
    synonyms: ['activo', 'equipo', 'codigo activo', 'código activo', 'tag', 'ubicacion tecnica', 'ubicación técnica', 'asset', 'equipment', 'maquina', 'máquina', 'id activo', 'cod equipo']
  },
  {
    key: 'descripcionActivo',
    label: 'Descripción del Activo',
    required: false,
    description: 'Nombre detallado o descripción del equipo intervenido.',
    synonyms: ['descripcion activo', 'descripción activo', 'nombre equipo', 'desc activo', 'asset description', 'nombre activo', 'descripcion equipo', 'descripción equipo']
  },
  {
    key: 'fechaFin',
    label: 'Fecha de Fin',
    required: false,
    description: 'Fecha de finalización de la labor.',
    synonyms: ['fecha fin', 'fecha de fin', 'f. fin', 'fin', 'fecha hasta', 'end date', 'fecha_fin', 'f_fin', 'fechafin']
  },
  {
    key: 'observaciones',
    label: 'Observaciones / Comentarios',
    required: false,
    description: 'Notas o comentarios sobre el trabajo realizado.',
    synonyms: ['observaciones', 'comentarios', 'notas', 'observacion', 'observación', 'descripcion', 'descripción', 'observaciones ot', 'detalle']
  },
  {
    key: 'tarea',
    label: 'Código de Tarea / Operación',
    required: false,
    description: 'Código de la tarea u operación ejecutada.',
    synonyms: ['tarea', 'operacion', 'operación', 'codigo tarea', 'código tarea', 'task', 'id tarea', 'num tarea']
  },
  {
    key: 'descripcionTareas',
    label: 'Descripción de Tareas',
    required: false,
    description: 'Detalle o descripción de las actividades efectuadas.',
    synonyms: ['descripcion tareas', 'descripción tareas', 'detalle tareas', 'descripcion tarea', 'descripción tarea', 'actividades']
  },
  {
    key: 'planMantenimiento',
    label: 'Plan de Mantenimiento',
    required: false,
    description: 'Plan o rutina preventiva asociada.',
    synonyms: ['plan mantenimiento', 'plan de mantenimiento', 'plan', 'pm', 'codigo plan', 'código plan', 'mantenimiento preventivo']
  },
  {
    key: 'idInforme',
    label: 'Nº / ID de Informe',
    required: false,
    description: 'Número de informe de mano de obra.',
    synonyms: ['id informe', 'informe', 'nº informe', 'num informe', 'numero informe', 'report id', 'nro informe', 'idinforme']
  }
];

// ── 2. PREFERENCIAS Y PRESETS (LOCAL STORAGE) ──────────────────────

const PREF_STORAGE_KEY = 'maintenance_column_mapping_pref';
const PRESETS_STORAGE_KEY = 'maintenance_column_mapping_presets';
const REPORTS_HISTORY_KEY = 'maintenance_reports_history';

function getSafeLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function getStoredMappingPreference(): MaintenanceColumnMapping | null {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return null;
    const raw = storage.getItem(PREF_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading column mapping preference:", e);
    return null;
  }
}

export function saveStoredMappingPreference(mapping: MaintenanceColumnMapping): void {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return;
    storage.setItem(PREF_STORAGE_KEY, JSON.stringify(mapping));
  } catch (e) {
    console.error("Error saving column mapping preference:", e);
  }
}

export function getAllMappingPresets(): ColumnMappingPreference[] {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return [];
    const raw = storage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveMappingPreset(name: string, mapping: MaintenanceColumnMapping): ColumnMappingPreference {
  const presets = getAllMappingPresets();
  const newPreset: ColumnMappingPreference = {
    id: crypto.randomUUID(),
    name: name.trim() || `Preset ${new Date().toLocaleDateString()}`,
    mapping,
    updatedAt: Date.now()
  };
  presets.push(newPreset);
  const storage = getSafeLocalStorage();
  if (storage) {
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }
  return newPreset;
}

export function deleteMappingPreset(id: string): void {
  const presets = getAllMappingPresets().filter(p => p.id !== id);
  const storage = getSafeLocalStorage();
  if (storage) {
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }
}

// ── 3. PARSEO DE EXCEL Y CSV ───────────────────────────────────────

export interface ParsedWorkbookResult {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  sampleRows: Record<string, any>[];
  allRawRows: Record<string, any>[];
  totalRows: number;
}

/**
 * Normaliza cadenas para comparación fuzzy (minúsculas, sin tildes, sin signos).
 */
function normalizeHeaderString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]/g, " ") // quitar símbolos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsea un archivo Excel (.xlsx, .xls) o CSV usando SheetJS.
 */
export async function parseExcelOrCSVFile(file: File, sheetIndex = 0): Promise<ParsedWorkbookResult> {
  const buffer = await file.arrayBuffer();
  
  // Opciones de lectura optimizadas para fechas
  const workbook = XLSX.read(buffer, { 
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
    raw: false,
    dateNF: 'yyyy-mm-dd hh:mm:ss'
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("El archivo no contiene hojas válidas.");
  }

  const activeSheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[activeSheetName];

  // Convertir a matriz JSON cruda para detectar encabezados correctamente
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: '', 
    blankrows: false 
  });

  if (rawMatrix.length === 0) {
    throw new Error("La hoja seleccionada está vacía.");
  }

  // Encontrar la primera fila con al menos 2 columnas no vacías (por si hay títulos arriba)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
    const nonEmptyCount = rawMatrix[i].filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').length;
    if (nonEmptyCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawMatrix[headerRowIndex].map((h: any, idx: number) => {
    const val = String(h || '').trim();
    return val !== '' ? val : `Columna_${idx + 1}`;
  });

  // Convertir datos a objetos usando los encabezados encontrados
  const allRawRows: Record<string, any>[] = [];
  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const rowArray = rawMatrix[r];
    if (!rowArray || rowArray.length === 0) continue;
    
    // Verificar si la fila no está totalmente vacía
    const hasData = rowArray.some(c => c !== undefined && c !== null && String(c).trim() !== '');
    if (!hasData) continue;

    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((header, cIdx) => {
      rowObj[header] = rowArray[cIdx] !== undefined ? rowArray[cIdx] : '';
    });
    allRawRows.push(rowObj);
  }

  return {
    sheetNames: workbook.SheetNames,
    activeSheet: activeSheetName,
    headers: rawHeaders,
    sampleRows: allRawRows.slice(0, 4),
    allRawRows,
    totalRows: allRawRows.length
  };
}

// ── 4. DETECCIÓN INTELIGENTE Y ASIGNACIÓN DE COLUMNAS ───────────────

export interface AutoDetectResult {
  mapping: MaintenanceColumnMapping;
  sources: Record<MaintenanceFieldKey, 'saved_preference' | 'auto_detected' | 'unmapped'>;
  unmappedRequiredCount: number;
}

export function autoDetectColumnMapping(
  headers: string[], 
  savedPreference?: MaintenanceColumnMapping | null
): AutoDetectResult {
  const mapping: MaintenanceColumnMapping = {};
  const sources: Record<MaintenanceFieldKey, 'saved_preference' | 'auto_detected' | 'unmapped'> = {} as any;
  const pref = savedPreference || getStoredMappingPreference();

  // Lista de encabezados normalizados para búsqueda
  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeaderString(h)
  }));

  // 1. Intentar aplicar preferencia guardada primero
  if (pref) {
    for (const field of MAINTENANCE_FIELDS) {
      const preferredHeader = pref[field.key];
      if (preferredHeader) {
        // Verificar si la columna preferida existe exactamente o normalizada
        const exactMatch = headers.find(h => h === preferredHeader);
        if (exactMatch) {
          mapping[field.key] = exactMatch;
          sources[field.key] = 'saved_preference';
          continue;
        }

        const prefNorm = normalizeHeaderString(preferredHeader);
        const normMatch = normalizedHeaders.find(nh => nh.normalized === prefNorm);
        if (normMatch) {
          mapping[field.key] = normMatch.original;
          sources[field.key] = 'saved_preference';
          continue;
        }
      }
    }
  }

  // 2. Para campos aún no mapeados, usar coincidencia por sinónimos y aproximación
  for (const field of MAINTENANCE_FIELDS) {
    if (mapping[field.key]) continue; // Ya mapeado por preferencia

    let foundHeader: string | null = null;

    // Buscar coincidencia exacta o por sinónimos
    for (const synonym of field.synonyms) {
      const synNorm = normalizeHeaderString(synonym);

      // Coincidencia exacta de sinónimo normalizado
      const directMatch = normalizedHeaders.find(nh => nh.normalized === synNorm);
      if (directMatch) {
        foundHeader = directMatch.original;
        break;
      }

      // Coincidencia parcial (el encabezado contiene el sinónimo o viceversa)
      const partialMatch = normalizedHeaders.find(nh => 
        nh.normalized.includes(synNorm) || (synNorm.length > 4 && synNorm.includes(nh.normalized))
      );
      if (partialMatch) {
        foundHeader = partialMatch.original;
        break;
      }
    }

    if (foundHeader) {
      mapping[field.key] = foundHeader;
      sources[field.key] = 'auto_detected';
    } else {
      sources[field.key] = 'unmapped';
    }
  }

  // Contar requeridos sin mapear
  let unmappedRequiredCount = 0;
  for (const field of MAINTENANCE_FIELDS) {
    if (field.required && !mapping[field.key]) {
      unmappedRequiredCount++;
    }
  }

  return {
    mapping,
    sources,
    unmappedRequiredCount
  };
}

// ── 5. PARSEO DE FECHAS Y HORAS ────────────────────────────────────

/**
 * Parsea fechas en formatos variados: Date de JS, números de Excel, strings DD/MM/YYYY, YYYY-MM-DD, etc.
 */
export function parseFlexibleDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;

  // Si ya es un objeto Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }

  // Si es un número serial de Excel (ej: 45430.354)
  if (typeof val === 'number' && val > 1000) {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      return new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H || 0, dateObj.M || 0, Math.floor(dateObj.S || 0));
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Formato DD/MM/YYYY o DD-MM-YYYY (con o sin hora)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback a Date.parse
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  return null;
}

/**
 * Parsea tiempos en HH:mm:ss, HH:mm, decimales de horas (2.5), minutos o serial de tiempo.
 */
export function parseFlexibleTime(val: any): { minutes: number; hours: number; formatted: string } {
  if (val === null || val === undefined || val === '') {
    return { minutes: 0, hours: 0, formatted: '00:00' };
  }

  // Si es número (ej: 2.5 horas o fracción de día de Excel)
  if (typeof val === 'number') {
    // Si es un número pequeño menor a 1, probablemente sea fracción de día de Excel
    let totalMinutes = 0;
    if (val > 0 && val < 1) {
      totalMinutes = Math.round(val * 24 * 60);
    } else {
      // Es horas decimales (ej: 2.5 = 150 min)
      totalMinutes = Math.round(val * 60);
    }
    const hours = Math.round((totalMinutes / 60) * 100) / 100;
    return {
      minutes: totalMinutes,
      hours,
      formatted: minutesToFormatted(totalMinutes)
    };
  }

  const str = String(val).trim();

  // Formato HH:mm:ss o HH:mm
  const timeMatch = str.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    const totalMinutes = h * 60 + m;
    return {
      minutes: totalMinutes,
      hours: Math.round((totalMinutes / 60) * 100) / 100,
      formatted: minutesToFormatted(totalMinutes)
    };
  }

  // Formato número con decimales "2,5" o "2.5" horas
  const numericStr = str.replace(',', '.');
  const num = parseFloat(numericStr);
  if (!isNaN(num)) {
    const totalMinutes = Math.round(num * 60);
    return {
      minutes: totalMinutes,
      hours: Math.round(num * 100) / 100,
      formatted: minutesToFormatted(totalMinutes)
    };
  }

  return { minutes: 0, hours: 0, formatted: '00:00' };
}

export function minutesToFormatted(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDate(d: Date): string {
  if (!d || isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ── 6. NORMALIZACIÓN DE FILAS SEGÚN MAPEO ──────────────────────────

export function mapAndNormalizeRows(
  rawRows: Record<string, any>[], 
  mapping: MaintenanceColumnMapping
): MaintenanceRow[] {
  const normalized: MaintenanceRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];

    const getVal = (key: MaintenanceFieldKey): string => {
      const colName = mapping[key];
      if (!colName) return '';
      const val = raw[colName];
      return val !== undefined && val !== null ? String(val).trim() : '';
    };

    const getRawVal = (key: MaintenanceFieldKey): any => {
      const colName = mapping[key];
      if (!colName) return '';
      return raw[colName];
    };

    const ot = getVal('ot');
    const trabajador = getVal('trabajador');
    const rawFechaInicio = getRawVal('fechaInicio');
    const fechaInicio = parseFlexibleDate(rawFechaInicio);

    // Omitir filas que no tengan ni OT ni fecha válida
    if (!ot && !trabajador && !fechaInicio) continue;

    const rawFechaFin = getRawVal('fechaFin');
    const fechaFin = parseFlexibleDate(rawFechaFin) || undefined;

    const rawTiempo = getRawVal('tiempoTotal');
    const timeParsed = parseFlexibleTime(rawTiempo);

    normalized.push({
      idInforme: getVal('idInforme') || `INF-${i + 1}`,
      fechaInicio: fechaInicio || new Date(),
      fechaFin,
      ot: ot || '(Sin OT)',
      tipoOT: getVal('tipoOT') || 'No clasificado',
      activo: getVal('activo') || '(Sin Activo)',
      descripcionActivo: getVal('descripcionActivo') || '',
      trabajador: trabajador || '(Sin Trabajador)',
      tiempoTotal: timeParsed.formatted,
      tiempoMinutos: timeParsed.minutes,
      tiempoHoras: timeParsed.hours,
      observaciones: getVal('observaciones') || '',
      tarea: getVal('tarea') || '',
      descripcionTareas: getVal('descripcionTareas') || '',
      planMantenimiento: getVal('planMantenimiento') || '',
      rawRowData: raw
    });
  }

  return normalized;
}

// ── 7. DETECCIÓN DE PERÍODOS Y CÓMPUTO DE ESTADÍSTICAS ─────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=dom, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getFirstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getLastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

const TOP_ASSETS_LIMIT = 15;

export function computeMaintenanceStats(
  rows: MaintenanceRow[],
  periodType: 'semanal' | 'mensual' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date
): MaintenanceStats | null {
  if (rows.length === 0) return null;

  // 1. Determinar rango de fechas
  let periodStart: Date;
  let periodEnd: Date;

  if (periodType === 'custom' && customStartDate && customEndDate) {
    periodStart = new Date(customStartDate);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(customEndDate);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    // Tomar la fecha más reciente como referencia
    const dates = rows.map(r => r.fechaInicio.getTime()).sort((a, b) => a - b);
    const lastDate = new Date(dates[dates.length - 1]);

    if (periodType === 'semanal') {
      periodStart = getMonday(lastDate);
      periodEnd = getSunday(lastDate);
    } else {
      periodStart = getFirstOfMonth(lastDate);
      periodEnd = getLastOfMonth(lastDate);
    }
  }

  // 2. Filtrar filas del período
  const filtered = rows.filter(r => {
    const t = r.fechaInicio.getTime();
    return t >= periodStart.getTime() && t <= periodEnd.getTime();
  });

  if (filtered.length === 0) return null;

  const periodLabel = `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

  // 3. Totales generales
  const uniqueOTs = new Set(filtered.map(r => r.ot));
  let totalMinutes = 0;
  for (const r of filtered) {
    totalMinutes += r.tiempoMinutos;
  }
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const totalHoursFormatted = minutesToFormatted(totalMinutes);

  // 4. Por Trabajador
  const workerMap = new Map<string, { records: number; minutes: number; ots: Set<string> }>();
  for (const r of filtered) {
    const name = r.trabajador || "(sin nombre)";
    const w = workerMap.get(name) ?? { records: 0, minutes: 0, ots: new Set() };
    w.records++;
    w.minutes += r.tiempoMinutos;
    w.ots.add(r.ot);
    workerMap.set(name, w);
  }

  const workers: WorkerStat[] = Array.from(workerMap.entries())
    .map(([name, data]) => {
      const hours = Math.round((data.minutes / 60) * 100) / 100;
      const percent = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 1000) / 10 : 0;
      return {
        name,
        ots: data.ots.size,
        records: data.records,
        hours,
        hoursFormatted: minutesToFormatted(data.minutes),
        percentOfTotal: percent
      };
    })
    .sort((a, b) => b.hours - a.hours);

  // 5. Por Tipo de OT
  const typeMap = new Map<string, { records: number; minutes: number; ots: Set<string> }>();
  let preventiveMinutes = 0;
  let correctiveMinutes = 0;
  let otherMinutes = 0;

  for (const r of filtered) {
    const tipo = r.tipoOT || "(sin tipo)";
    const t = typeMap.get(tipo) ?? { records: 0, minutes: 0, ots: new Set() };
    t.records++;
    t.minutes += r.tiempoMinutos;
    t.ots.add(r.ot);
    typeMap.set(tipo, t);

    const tipoNorm = normalizeHeaderString(tipo);
    if (tipoNorm.includes('preventiv') || tipoNorm.includes('prev') || tipoNorm.includes('plan')) {
      preventiveMinutes += r.tiempoMinutos;
    } else if (tipoNorm.includes('correctiv') || tipoNorm.includes('averia') || tipoNorm.includes('urgente') || tipoNorm.includes('falla')) {
      correctiveMinutes += r.tiempoMinutos;
    } else {
      otherMinutes += r.tiempoMinutos;
    }
  }

  const byType: TypeStat[] = Array.from(typeMap.entries())
    .map(([name, data]) => {
      const hours = Math.round((data.minutes / 60) * 100) / 100;
      const avgMin = data.records > 0 ? Math.round(data.minutes / data.records) : 0;
      const percent = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 1000) / 10 : 0;
      return {
        name,
        ots: data.ots.size,
        records: data.records,
        hours,
        hoursFormatted: minutesToFormatted(data.minutes),
        avgMinutes: avgMin,
        avgFormatted: minutesToFormatted(avgMin),
        percentOfTotal: percent
      };
    })
    .sort((a, b) => b.hours - a.hours);

  // 6. Por Activo
  const assetMap = new Map<string, { records: number; minutes: number; ots: Set<string> }>();
  for (const r of filtered) {
    const asset = r.activo || "(sin activo)";
    const a = assetMap.get(asset) ?? { records: 0, minutes: 0, ots: new Set() };
    a.records++;
    a.minutes += r.tiempoMinutos;
    a.ots.add(r.ot);
    assetMap.set(asset, a);
  }

  const byAsset: AssetStat[] = Array.from(assetMap.entries())
    .map(([name, data]) => {
      const hours = Math.round((data.minutes / 60) * 100) / 100;
      const percent = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 1000) / 10 : 0;
      return {
        name,
        hours,
        hoursFormatted: minutesToFormatted(data.minutes),
        ots: data.ots.size,
        records: data.records,
        percentOfTotal: percent
      };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, TOP_ASSETS_LIMIT);

  // 7. Ratios y Riesgos
  const prevHours = Math.round((preventiveMinutes / 60) * 100) / 100;
  const corrHours = Math.round((correctiveMinutes / 60) * 100) / 100;
  const othHours = Math.round((otherMinutes / 60) * 100) / 100;
  const preventiveRatio = totalMinutes > 0 ? Math.round((preventiveMinutes / totalMinutes) * 100) : 0;
  const correctiveRatio = totalMinutes > 0 ? Math.round((correctiveMinutes / totalMinutes) * 100) : 0;

  const topRisks: string[] = [];
  if (workers.length === 1) {
    topRisks.push(`Riesgo de dependencia crítica: El 100% de la carga de mantenimiento fue ejecutada por un único técnico (${workers[0].name}).`);
  } else if (workers.length > 1 && workers[0].percentOfTotal >= 65) {
    topRisks.push(`Concentración excesiva de carga: ${workers[0].name} asumió el ${workers[0].percentOfTotal}% de todas las horas trabajadas.`);
  }

  if (correctiveRatio > 50) {
    topRisks.push(`Mantenimiento reactivo dominante: El correctivo representó el ${correctiveRatio}% del tiempo total (${corrHours}h), lo que indica alta frecuencia de fallas no planificadas.`);
  }

  if (byAsset.length > 0 && byAsset[0].percentOfTotal >= 35) {
    topRisks.push(`Cuello de botella en activo: El equipo ${byAsset[0].name} consumió el ${byAsset[0].percentOfTotal}% del tiempo total de intervención.`);
  }

  return {
    periodLabel,
    periodType,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    totalRecords: filtered.length,
    uniqueOTs: uniqueOTs.size,
    totalHours,
    totalHoursFormatted,
    workers,
    byType,
    byAsset,
    preventiveHours: prevHours,
    correctiveHours: corrHours,
    otherHours: othHours,
    preventiveRatio,
    correctiveRatio,
    topRisks
  };
}

// ── 8. CONSTRUCCIÓN DE RESUMEN VERIFICADO PARA LLM ──────────────────

export function buildStatsSummary(stats: MaintenanceStats): string {
  const lines: string[] = [];

  lines.push(`## Estadísticas Verificadas del Período`);
  lines.push(`- Período: ${stats.periodLabel}`);
  lines.push(`- Tipo: ${stats.periodType.toUpperCase()}`);
  lines.push(`- Total Órdenes de Trabajo (OTs) únicas: ${stats.uniqueOTs}`);
  lines.push(`- Total registros de mano de obra: ${stats.totalRecords}`);
  lines.push(`- Horas totales invertidas: ${stats.totalHoursFormatted} (${stats.totalHours} horas)`);
  lines.push(`- Ratio Preventivo: ${stats.preventiveRatio}% (${stats.preventiveHours}h)`);
  lines.push(`- Ratio Correctivo: ${stats.correctiveRatio}% (${stats.correctiveHours}h)`);
  lines.push("");

  lines.push("### Por Trabajador / Técnico");
  for (const w of stats.workers) {
    lines.push(
      `- **${w.name}**: ${w.ots} OTs, ${w.records} registros, ${w.hoursFormatted} (${w.hours}h, ${w.percentOfTotal}%)`
    );
  }
  lines.push("");

  lines.push("### Por Tipo de OT");
  for (const t of stats.byType) {
    lines.push(
      `- **${t.name}**: ${t.ots} OTs, ${t.records} registros, ${t.hoursFormatted} (media por intervención: ${t.avgFormatted}, ${t.percentOfTotal}%)`
    );
  }
  lines.push("");

  lines.push(`### Top ${stats.byAsset.length} Activos más Intervenidos (por horas)`);
  for (const a of stats.byAsset) {
    lines.push(
      `- **${a.name}**: ${a.hoursFormatted} (${a.hours}h), ${a.ots} OTs, ${a.records} registros (${a.percentOfTotal}%)`
    );
  }
  lines.push("");

  if (stats.topRisks.length > 0) {
    lines.push("### Hallazgos Críticos y Riesgos Detectados");
    for (const r of stats.topRisks) {
      lines.push(`- ⚠️ ${r}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── 9. HISTORIAL DE REPORTES GENERADOS ──────────────────────────────

export function getReportHistory(): MaintenanceReportRecord[] {
  try {
    const storage = getSafeLocalStorage();
    if (!storage) return [];
    const raw = storage.getItem(REPORTS_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveReportToHistory(report: MaintenanceReportRecord): void {
  const history = getReportHistory();
  const index = history.findIndex(r => r.id === report.id);
  if (index >= 0) {
    history[index] = report;
  } else {
    history.unshift(report);
  }
  // Limitar a los 30 reportes más recientes
  const trimmed = history.slice(0, 30);
  const storage = getSafeLocalStorage();
  if (storage) {
    storage.setItem(REPORTS_HISTORY_KEY, JSON.stringify(trimmed));
  }
}

export function deleteReportFromHistory(id: string): void {
  const history = getReportHistory().filter(r => r.id !== id);
  const storage = getSafeLocalStorage();
  if (storage) {
    storage.setItem(REPORTS_HISTORY_KEY, JSON.stringify(history));
  }
}
