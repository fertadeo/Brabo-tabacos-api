import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/jwt';
import { SystemEventRepository } from '../repositories/SystemEventRepository';
import {
  CreateSystemEventInput,
  SystemEventFilters,
  SystemEventSeverity,
  SystemEventType,
} from '../entities/SystemEvent';
import { executeQuery } from '../config/database';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rutas que no se registran como actividad (evitar ruido o recursión) */
const SKIP_PATH_PREFIXES = [
  '/api/system-health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/me',
  '/api/integration/webhook',
  '/api/woocommerce',
  '/health',
];

function normalizeUserId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function resolveActor(
  req: Request | AuthenticatedRequest,
  partial: Partial<CreateSystemEventInput>
): Pick<CreateSystemEventInput, 'user_id' | 'username' | 'user_role'> {
  const authReq = req as AuthenticatedRequest & {
    user?: { id?: unknown; username?: string; name?: string; role?: string; type?: string };
  };

  const rawId = partial.user_id ?? authReq.user?.id;
  const user_id = normalizeUserId(rawId);

  const username =
    partial.username ??
    authReq.user?.username ??
    (typeof rawId === 'string' && user_id == null ? rawId : null) ??
    authReq.user?.name ??
    null;

  const user_role = partial.user_role ?? authReq.user?.role ?? authReq.user?.type ?? null;

  return { user_id, username, user_role };
}

export const ActivityLoggerService = {
  async log(input: CreateSystemEventInput): Promise<void> {
    try {
      await SystemEventRepository.create(input);
    } catch (err: any) {
      console.error('[ActivityLogger] Error al guardar evento:', err.message);
    }
  },

  logAsync(input: CreateSystemEventInput): void {
    this.log(input).catch(() => undefined);
  },

  fromRequest(
    req: Request | AuthenticatedRequest,
    partial: Omit<CreateSystemEventInput, 'ip_address' | 'user_agent' | 'request_method' | 'request_path'>
  ): CreateSystemEventInput {
    return {
      ...partial,
      ...resolveActor(req, partial),
      request_method: req.method,
      request_path: req.originalUrl || req.url,
      ip_address: (req.ip || req.socket?.remoteAddress || null) as string | null,
      user_agent: (req.get('user-agent') || null) as string | null,
    };
  },

  logActivity(req: Request | AuthenticatedRequest, message: string, extra?: Partial<CreateSystemEventInput>): void {
    this.logAsync(this.fromRequest(req, {
      event_type: 'activity',
      severity: 'info',
      action: extra?.action ?? req.method.toLowerCase(),
      module: extra?.module ?? extractModule(req.originalUrl || req.url),
      message,
      ...extra,
    }));
  },

  logError(req: Request | AuthenticatedRequest, message: string, extra?: Partial<CreateSystemEventInput>): void {
    this.logAsync(this.fromRequest(req, {
      event_type: 'error',
      severity: extra?.severity ?? 'error',
      action: extra?.action ?? 'error',
      module: extra?.module ?? extractModule(req.originalUrl || req.url),
      message,
      ...extra,
    }));
  },

  logAlert(req: Request | AuthenticatedRequest, message: string, extra?: Partial<CreateSystemEventInput>): void {
    this.logAsync(this.fromRequest(req, {
      event_type: 'alert',
      severity: extra?.severity ?? 'warning',
      action: extra?.action ?? 'alert',
      module: extra?.module ?? extractModule(req.originalUrl || req.url),
      message,
      ...extra,
    }));
  },

  shouldLogRequest(method: string, path: string): boolean {
    if (!MUTATING_METHODS.has(method)) return false;
    return !SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  },

  buildActivityMessage(method: string, path: string, statusCode: number, username?: string): string {
    const user = username ? `Usuario ${username}` : 'Usuario anónimo';
    const action = describeAction(method, path);
    const status = statusCode >= 400 ? `falló (${statusCode})` : `exitoso (${statusCode})`;
    return `${user}: ${action} — ${status}`;
  },
};

export const SystemHealthService = {
  async getEvents(filters: SystemEventFilters) {
    return SystemEventRepository.findAll(filters);
  },

  async getStats() {
    return SystemEventRepository.getStats();
  },

  async getModules() {
    return SystemEventRepository.getDistinctModules();
  },

  async getOverview(filters: SystemEventFilters = {}) {
    const [status, stats, modules, eventsResult] = await Promise.all([
      this.getSystemStatus(),
      this.getStats(),
      this.getModules(),
      SystemEventRepository.findAll(filters),
    ]);
    return { status, stats, modules, events: eventsResult.events, total: eventsResult.total };
  },

  async getSystemStatus() {
    let dbConnected = false;
    try {
      await executeQuery('SELECT 1 AS ok');
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
    return {
      api: 'ok',
      database: dbConnected ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
    };
  },
};

function extractModule(path: string): string {
  const match = path.match(/^\/api\/([^/?]+)/);
  return match?.[1] ?? 'system';
}

function describeAction(method: string, path: string): string {
  const module = extractModule(path);
  const labels: Record<string, string> = {
    POST: 'creó',
    PUT: 'actualizó',
    PATCH: 'modificó',
    DELETE: 'eliminó',
  };
  const verb = labels[method] ?? method;
  return `${verb} en ${module} (${path})`;
}

export type { SystemEventType, SystemEventSeverity };
