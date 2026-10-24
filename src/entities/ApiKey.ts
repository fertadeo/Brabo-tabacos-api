export interface ApiKey {
  id: number;
  key_name: string;
  api_key: string; // Solo se muestra al crear, luego se oculta
  key_hash: string;
  description?: string;
  created_by?: number;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  allowed_ips?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyData {
  key_name: string;
  description?: string;
  expires_at?: string;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  allowed_ips?: string;
  metadata?: Record<string, any>;
}

export interface UpdateApiKeyData {
  key_name?: string;
  description?: string;
  is_active?: boolean;
  expires_at?: string;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  allowed_ips?: string;
  metadata?: Record<string, any>;
}

export interface ApiKeyWithCreator extends ApiKey {
  creator_name?: string;
  creator_email?: string;
}




