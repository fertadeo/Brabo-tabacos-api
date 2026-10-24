export type SystemEventType = 'activity' | 'error' | 'alert';
export type SystemEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SystemEvent {
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
  metadata: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

export interface CreateSystemEventInput {
  event_type: SystemEventType;
  severity?: SystemEventSeverity;
  module?: string;
  action?: string;
  message: string;
  user_id?: number | null;
  username?: string | null;
  user_role?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  status_code?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  duration_ms?: number | null;
}

export interface SystemEventFilters {
  event_type?: SystemEventType;
  severity?: SystemEventSeverity;
  module?: string;
  user_id?: number;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface SystemEventStats {
  total: number;
  last24h: {
    activity: number;
    error: number;
    alert: number;
  };
  bySeverity: Record<SystemEventSeverity, number>;
  topModules: Array<{ module: string; count: number }>;
  recentErrors: SystemEvent[];
}
