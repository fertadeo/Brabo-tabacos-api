import { executeQuery } from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  CreateSystemEventInput,
  SystemEvent,
  SystemEventFilters,
  SystemEventSeverity,
  SystemEventStats,
  SystemEventType,
} from '../entities/SystemEvent';

/** Por defecto solo consultar últimos 30 días para evitar COUNT lentos */
const DEFAULT_LOOKBACK_DAYS = 30;

interface DBSystemEvent extends RowDataPacket {
  id: number;
  event_type: SystemEventType;
  severity: SystemEventSeverity;
  module: string;
  action: string;
  message: string;
  user_id: number | null;
  username: string | null;
  user_role: string | null;
  request_method: string | null;
  request_path: string | null;
  status_code: number | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

function parseMetadata(value: DBSystemEvent['metadata']): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeUserId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function mapRow(row: DBSystemEvent): SystemEvent {
  return {
    id: row.id,
    event_type: row.event_type,
    severity: row.severity,
    module: row.module,
    action: row.action,
    message: row.message,
    user_id: row.user_id,
    username: row.username,
    user_role: row.user_role,
    request_method: row.request_method,
    request_path: row.request_path,
    status_code: row.status_code,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    metadata: parseMetadata(row.metadata),
    duration_ms: row.duration_ms,
    created_at: row.created_at,
  };
}

export const SystemEventRepository = {
  async create(input: CreateSystemEventInput): Promise<number> {
    const sql = `
      INSERT INTO system_events (
        event_type, severity, module, action, message,
        user_id, username, user_role,
        request_method, request_path, status_code,
        ip_address, user_agent, metadata, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const result: any = await executeQuery(sql, [
      input.event_type,
      input.severity ?? 'info',
      input.module ?? 'system',
      input.action ?? 'unknown',
      input.message,
      input.user_id != null ? normalizeUserId(input.user_id) : null,
      input.username ?? null,
      input.user_role ?? null,
      input.request_method ?? null,
      input.request_path ?? null,
      input.status_code ?? null,
      input.ip_address ?? null,
      input.user_agent ?? null,
      metadata,
      input.duration_ms ?? null,
    ]);
    return result.insertId as number;
  },

  async findAll(filters: SystemEventFilters = {}): Promise<{ events: SystemEvent[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.event_type) {
      where += ' AND event_type = ?';
      params.push(filters.event_type);
    }
    if (filters.severity) {
      where += ' AND severity = ?';
      params.push(filters.severity);
    }
    if (filters.module) {
      where += ' AND module = ?';
      params.push(filters.module);
    }
    if (filters.user_id) {
      where += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.from) {
      where += ' AND created_at >= ?';
      params.push(filters.from);
    }
    if (filters.to) {
      where += ' AND created_at <= ?';
      params.push(filters.to);
    }
    if (!filters.from && !filters.to && !filters.search) {
      where += ` AND created_at >= DATE_SUB(NOW(), INTERVAL ${DEFAULT_LOOKBACK_DAYS} DAY)`;
    }
    if (filters.search) {
      where += ' AND (message LIKE ? OR username LIKE ? OR request_path LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const countSql = `SELECT COUNT(*) as cnt FROM system_events ${where}`;
    const countRows = await executeQuery(countSql, params) as Array<{ cnt: number }>;
    const total = countRows[0]?.cnt ?? 0;

    const sql = `
      SELECT id, event_type, severity, module, action, message,
        user_id, username, user_role, request_method, request_path,
        status_code, ip_address, duration_ms, created_at
      FROM system_events
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await executeQuery(sql, params) as DBSystemEvent[];
    return { events: rows.map(mapRow), total };
  },

  async getStats(): Promise<SystemEventStats> {
    const [summaryRows, topModuleRows, recentErrorRows] = await Promise.all([
      executeQuery(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND event_type = 'activity' THEN 1 ELSE 0 END) AS activity_24h,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND event_type = 'error' THEN 1 ELSE 0 END) AS error_24h,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND event_type = 'alert' THEN 1 ELSE 0 END) AS alert_24h,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND severity = 'info' THEN 1 ELSE 0 END) AS sev_info,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND severity = 'warning' THEN 1 ELSE 0 END) AS sev_warning,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND severity = 'error' THEN 1 ELSE 0 END) AS sev_error,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND severity = 'critical' THEN 1 ELSE 0 END) AS sev_critical
        FROM system_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${DEFAULT_LOOKBACK_DAYS} DAY)
      `),
      executeQuery(`
        SELECT module, COUNT(*) as cnt
        FROM system_events
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY module
        ORDER BY cnt DESC
        LIMIT 8
      `),
      executeQuery(`
        SELECT id, event_type, severity, module, action, message,
          user_id, username, user_role, request_method, request_path,
          status_code, ip_address, duration_ms, created_at
        FROM system_events
        WHERE event_type IN ('error', 'alert')
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]) as [RowDataPacket[], Array<{ module: string; cnt: number }>, DBSystemEvent[]];

    const summary = summaryRows[0] ?? {};
    const last24h = {
      activity: Number(summary.activity_24h ?? 0),
      error: Number(summary.error_24h ?? 0),
      alert: Number(summary.alert_24h ?? 0),
    };
    const bySeverity: Record<SystemEventSeverity, number> = {
      info: Number(summary.sev_info ?? 0),
      warning: Number(summary.sev_warning ?? 0),
      error: Number(summary.sev_error ?? 0),
      critical: Number(summary.sev_critical ?? 0),
    };

    return {
      total: Number(summary.total ?? 0),
      last24h,
      bySeverity,
      topModules: topModuleRows.map((r) => ({ module: r.module, count: r.cnt })),
      recentErrors: recentErrorRows.map(mapRow),
    };
  },

  async getDistinctModules(): Promise<string[]> {
    const rows = await executeQuery(`
      SELECT DISTINCT module FROM system_events
      WHERE module IS NOT NULL AND module != ''
      ORDER BY module ASC
      LIMIT 50
    `) as Array<{ module: string }>;
    return rows.map((r) => r.module);
  },
};
