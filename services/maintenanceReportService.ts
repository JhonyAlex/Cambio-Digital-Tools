/**
 * maintenanceReportService.ts
 *
 * Parser de CSV de Primavera (formato Mantenimiento Mano de Obra) y
 * computación exacta de estadísticas para reportes semanales/mensuales.
 *
 * El CSV usa ";" como delimitador. Las columnas 13-19 (observaciones, tareas)
 * pueden contener saltos de línea. Las primeras 12 columnas son siempre single-line.
 */

// ── Tipos internos ──────────────────────────────────────────────

export interface MaintenanceRow {
  informe: string;
  ot: string;
  fechaPrevista: Date;
  fechaInicio: Date;
  fechaFin: Date;
  descripcion: string;
  tipoOT: string;
  tipoActivo: string;
  activo: string;
  taller: string;
  trabajador: string;
  tiempoTotal: string; // formato "d.HH:mm:ss"
  observaciones: string;
  planMantenimiento: string;
  observacionesOT: string;
  observacionesPM: string;
  observacionesTareas: string;
  tarea: string;
  descripcionTareas: string;
}

export interface WorkerStat {
  name: string;
  ots: number;
  records: number;
  hours: number;
  hoursFormatted: string;
}

export interface TypeStat {
  name: string;
  ots: number;
  records: number;
  hours: number;
  hoursFormatted: string;
  avgMinutes: number;
  avgFormatted: string;
}

export interface AssetStat {
  name: string;
  hours: number;
  hoursFormatted: string;
  ots: number;
  records: number;
}

export interface MaintenanceStats {
  periodLabel: string;
  periodType: "semanal" | "mensual";
  totalRecords: number;
  uniqueOTs: number;
  totalHours: number;
  totalHoursFormatted: string;
  workers: WorkerStat[];
  byType: TypeStat[];
  byAsset: AssetStat[]; // top N, sorted by hours desc
  periodStart: string; // dd/mm/yyyy
  periodEnd: string;
}

export interface MaintenanceReportData {
  stats: MaintenanceStats;
  /** Texto plano con las estadísticas para mandar al LLM (narrativa) */
  statsSummary: string;
}

// ── Constantes ──────────────────────────────────────────────────

const CSV_DELIMITER = ";";
const EXPECTED_FIELDS = 19;

// ── Parseo de tiempo "d.HH:mm:ss" → minutos totales ─────────────

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d+)\.(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const days = parseInt(match[1], 10);
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = parseInt(match[4], 10);
  return days * 24 * 60 + hours * 60 + minutes + seconds / 60;
}

function minutesToFormatted(totalMinutes: number): string {
  const total = Math.round(totalMinutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// ── Parseo de fecha "d/M/yyyy H:mm:ss" ─────────────────────────

function parseDate(dateStr: string): Date {
  // Formato español: "18/5/2026 18:08:39"
  const cleaned = dateStr.trim();
  const [datePart, timePart] = cleaned.split(" ");
  const [d, m, y] = datePart.split("/").map(Number);
  if (!timePart) return new Date(y, m - 1, d);

  const [h, min, s] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, s);
}

function formatDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

// ── Parser de CSV ───────────────────────────────────────────────

function parseRow(raw: string): MaintenanceRow | null {
  const fields = raw.split(CSV_DELIMITER);
  if (fields.length < EXPECTED_FIELDS) return null;

  return {
    informe: fields[0]?.trim() ?? "",
    ot: fields[1]?.trim() ?? "",
    fechaPrevista: parseDate(fields[2] ?? ""),
    fechaInicio: parseDate(fields[3] ?? ""),
    fechaFin: parseDate(fields[4] ?? ""),
    descripcion: fields[5]?.trim() ?? "",
    tipoOT: fields[6]?.trim() ?? "",
    tipoActivo: fields[7]?.trim() ?? "",
    activo: fields[8]?.trim() ?? "",
    taller: fields[9]?.trim() ?? "",
    trabajador: fields[10]?.trim() ?? "",
    tiempoTotal: fields[11]?.trim() ?? "",
    observaciones: fields[12]?.trim() ?? "",
    planMantenimiento: fields[13]?.trim() ?? "",
    observacionesOT: fields[14]?.trim() ?? "",
    observacionesPM: fields[15]?.trim() ?? "",
    observacionesTareas: fields[16]?.trim() ?? "",
    tarea: fields[17]?.trim() ?? "",
    descripcionTareas: fields[18]?.trim() ?? "",
  };
}

/**
 * Parsea el CSV completo. Maneja campos multi-línea en las columnas
 * de observaciones/tareas. Cada fila lógica empieza con un número de informe.
 */
export function parsePrimaveraCSV(csvContent: string): MaintenanceRow[] {
  const rows: MaintenanceRow[] = [];
  const lines = csvContent.split(/\r?\n/);

  let buffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detecta inicio de nueva fila: primera columna es numérica (7-12 dígitos)
    const isNewRow = /^\d{7,12};/.test(line.trim());

    if (isNewRow && buffer !== "") {
      // Parsear buffer acumulado como fila completa
      const row = parseRow(buffer);
      if (row) rows.push(row);
      buffer = line;
    } else if (buffer !== "") {
      // Continuar acumulando (campo multi-línea)
      buffer += "\n" + line;
    } else {
      buffer = line;
    }
  }

  // Última fila
  if (buffer !== "") {
    const row = parseRow(buffer);
    if (row) rows.push(row);
  }

  return rows;
}

// ── Detección de período ────────────────────────────────────────

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
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getLastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// ── Cómputo de estadísticas ─────────────────────────────────────

const TOP_ASSETS = 15;

export function computeMaintenanceStats(
  rows: MaintenanceRow[],
  periodType: "semanal" | "mensual"
): MaintenanceStats | null {
  if (rows.length === 0) return null;

  // ── 1. Determinar período ──
  const dates = rows.map((r) => r.fechaInicio).sort((a, b) => a.getTime() - b.getTime());
  const lastDate = dates[dates.length - 1];

  let periodStart: Date;
  let periodEnd: Date;

  if (periodType === "semanal") {
    periodStart = getMonday(lastDate);
    periodEnd = getSunday(lastDate);
  } else {
    periodStart = getFirstOfMonth(lastDate);
    periodEnd = getLastOfMonth(lastDate);
  }

  // ── 2. Filtrar filas dentro del período ──
  const filtered = rows.filter((r) => {
    return r.fechaInicio >= periodStart && r.fechaInicio <= periodEnd;
  });

  if (filtered.length === 0) return null;

  const periodLabel =
    periodType === "semanal"
      ? `${formatDate(periodStart)} - ${formatDate(periodEnd)}`
      : `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

  // ── 3. Totales ──
  const uniqueOTs = new Set(filtered.map((r) => r.ot));
  let totalMinutes = 0;
  for (const r of filtered) {
    totalMinutes += parseTimeToMinutes(r.tiempoTotal);
  }

  // ── 4. Por trabajador ──
  const workerMap = new Map<
    string,
    { records: number; minutes: number; ots: Set<string> }
  >();
  for (const r of filtered) {
    const name = r.trabajador || "(sin nombre)";
    const w = workerMap.get(name) ?? {
      records: 0,
      minutes: 0,
      ots: new Set(),
    };
    w.records++;
    w.minutes += parseTimeToMinutes(r.tiempoTotal);
    w.ots.add(r.ot);
    workerMap.set(name, w);
  }

  const workers: WorkerStat[] = Array.from(workerMap.entries())
    .map(([name, data]) => ({
      name,
      ots: data.ots.size,
      records: data.records,
      hours: Math.round((data.minutes / 60) * 100) / 100,
      hoursFormatted: minutesToFormatted(data.minutes),
    }))
    .sort((a, b) => b.hours - a.hours);

  // ── 5. Por tipo de OT ──
  const typeMap = new Map<
    string,
    { records: number; minutes: number; ots: Set<string> }
  >();
  for (const r of filtered) {
    const tipo = r.tipoOT || "(sin tipo)";
    const t = typeMap.get(tipo) ?? {
      records: 0,
      minutes: 0,
      ots: new Set(),
    };
    t.records++;
    t.minutes += parseTimeToMinutes(r.tiempoTotal);
    t.ots.add(r.ot);
    typeMap.set(tipo, t);
  }

  const byType: TypeStat[] = Array.from(typeMap.entries())
    .map(([name, data]) => ({
      name,
      ots: data.ots.size,
      records: data.records,
      hours: Math.round((data.minutes / 60) * 100) / 100,
      hoursFormatted: minutesToFormatted(data.minutes),
      avgMinutes: Math.round(data.minutes / data.records),
      avgFormatted: minutesToFormatted(data.minutes / data.records),
    }))
    .sort((a, b) => b.hours - a.hours);

  // ── 6. Por activo ──
  const assetMap = new Map<
    string,
    { records: number; minutes: number; ots: Set<string> }
  >();
  for (const r of filtered) {
    const asset = r.activo || "(sin activo)";
    const a = assetMap.get(asset) ?? {
      records: 0,
      minutes: 0,
      ots: new Set(),
    };
    a.records++;
    a.minutes += parseTimeToMinutes(r.tiempoTotal);
    a.ots.add(r.ot);
    assetMap.set(asset, a);
  }

  const byAsset: AssetStat[] = Array.from(assetMap.entries())
    .map(([name, data]) => ({
      name,
      hours: Math.round((data.minutes / 60) * 100) / 100,
      hoursFormatted: minutesToFormatted(data.minutes),
      ots: data.ots.size,
      records: data.records,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, TOP_ASSETS);

  return {
    periodLabel,
    periodType,
    totalRecords: filtered.length,
    uniqueOTs: uniqueOTs.size,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalHoursFormatted: minutesToFormatted(totalMinutes),
    workers,
    byType,
    byAsset,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  };
}

// ── Generación del resumen estructurado para el LLM ─────────────

export function buildStatsSummary(stats: MaintenanceStats): string {
  const lines: string[] = [];

  lines.push(`## Estadísticas Verificadas del Período`);
  lines.push(`- Período: ${stats.periodLabel}`);
  lines.push(`- Tipo: ${stats.periodType === "semanal" ? "Semanal" : "Mensual"}`);
  lines.push(`- Total OTs únicas: ${stats.uniqueOTs}`);
  lines.push(`- Total registros de mano de obra: ${stats.totalRecords}`);
  lines.push(`- Horas totales: ${stats.totalHoursFormatted} (${stats.totalHours}h)`);
  lines.push("");

  lines.push("### Por Trabajador");
  for (const w of stats.workers) {
    lines.push(
      `- **${w.name}**: ${w.ots} OTs, ${w.records} registros, ${w.hoursFormatted}`
    );
  }
  lines.push("");

  lines.push("### Por Tipo de OT");
  for (const t of stats.byType) {
    lines.push(
      `- **${t.name}**: ${t.ots} OTs, ${t.records} registros, ${t.hoursFormatted} (media: ${t.avgFormatted})`
    );
  }
  lines.push("");

  lines.push(`### Top ${stats.byAsset.length} Activos (por horas)`);
  for (const a of stats.byAsset) {
    lines.push(
      `- **${a.name}**: ${a.hoursFormatted}, ${a.ots} OTs, ${a.records} registros`
    );
  }
  lines.push("");

  return lines.join("\n");
}

// ── Función principal: procesa CSV y devuelve datos listos ──────

export function processMaintenanceCSV(
  csvContent: string,
  periodType: "semanal" | "mensual"
): MaintenanceReportData | null {
  const rows = parsePrimaveraCSV(csvContent);
  if (rows.length === 0) return null;

  const stats = computeMaintenanceStats(rows, periodType);
  if (!stats) return null;

  const statsSummary = buildStatsSummary(stats);

  return { stats, statsSummary };
}
