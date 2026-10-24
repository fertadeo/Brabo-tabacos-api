import { executeQuery } from '../config/database';
import { ApiKey, CreateApiKeyData, UpdateApiKeyData, ApiKeyWithCreator } from '../entities/ApiKey';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface DBApiKey extends RowDataPacket, ApiKey {}

export class ApiKeyRepository {
  /**
   * Genera una nueva API Key aleatoria
   */
  static generateApiKey(): string {
    return `fnec_${crypto.randomBytes(32).toString('base64').replace(/[+/=]/g, '')}`;
  }

  /**
   * Genera el hash de una API Key para almacenamiento seguro
   * Reducido de 10 a 8 salt rounds para mejor rendimiento (sigue siendo seguro)
   * 8 rounds es ~4x más rápido que 10 rounds pero mantiene seguridad adecuada
   */
  static async hashApiKey(apiKey: string): Promise<string> {
    console.log('[API_KEY_REPO] Iniciando hash de API Key...');
    const startTime = Date.now();
    try {
      // Reducir salt rounds de 10 a 8 para mejorar rendimiento
      // 8 rounds sigue siendo seguro pero es ~4x más rápido
      const hash = await bcrypt.hash(apiKey, 8);
      const duration = Date.now() - startTime;
      console.log(`[API_KEY_REPO] Hash completado en ${duration}ms`);
      return hash;
    } catch (error: any) {
      console.error('[API_KEY_REPO] Error al hacer hash:', error);
      throw new Error(`Error al generar hash de API Key: ${error.message}`);
    }
  }

  /**
   * Verifica si una API Key coincide con su hash
   */
  static async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(apiKey, hash);
  }

  /**
   * Busca una API Key por su valor (hash)
   */
  async findByApiKey(apiKey: string): Promise<ApiKey | null> {
    const query = `
      SELECT * FROM api_keys 
      WHERE is_active = 1 
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    
    const rows = await executeQuery(query) as DBApiKey[];
    
    // Verificar cada API Key contra el hash
    for (const row of rows) {
      const isValid = await ApiKeyRepository.verifyApiKey(apiKey, row.key_hash);
      if (isValid) {
        return this.mapRowToApiKey(row);
      }
    }
    
    return null;
  }

  /**
   * Busca una API Key por ID
   */
  async findById(id: number): Promise<ApiKeyWithCreator | null> {
    const query = `
      SELECT 
        ak.*,
        u.username as creator_name,
        u.email as creator_email
      FROM api_keys ak
      LEFT JOIN users u ON ak.created_by = u.id
      WHERE ak.id = ?
    `;
    
    const rows = await executeQuery(query, [id]) as (DBApiKey & { creator_name?: string; creator_email?: string })[];
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      ...this.mapRowToApiKey(row),
      creator_name: row.creator_name,
      creator_email: row.creator_email
    };
  }

  /**
   * Obtiene todas las API Keys con paginación
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    is_active?: boolean;
    search?: string;
  } = {}): Promise<{ apiKeys: ApiKeyWithCreator[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        ak.*,
        u.username as creator_name,
        u.email as creator_email
      FROM api_keys ak
      LEFT JOIN users u ON ak.created_by = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (options.is_active !== undefined) {
      query += ` AND ak.is_active = ?`;
      params.push(options.is_active ? 1 : 0);
    }

    if (options.search) {
      query += ` AND (ak.key_name LIKE ? OR ak.description LIKE ?)`;
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY ak.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await executeQuery(query, params) as (DBApiKey & { creator_name?: string; creator_email?: string })[];
    
    // Contar total
    let countQuery = `SELECT COUNT(*) as total FROM api_keys WHERE 1=1`;
    const countParams: any[] = [];
    
    if (options.is_active !== undefined) {
      countQuery += ` AND is_active = ?`;
      countParams.push(options.is_active ? 1 : 0);
    }

    if (options.search) {
      countQuery += ` AND (key_name LIKE ? OR description LIKE ?)`;
      const searchTerm = `%${options.search}%`;
      countParams.push(searchTerm, searchTerm);
    }

    const countRows = await executeQuery(countQuery, countParams) as Array<{ total: number }>;
    const total = countRows[0]?.total || 0;

    const apiKeys = rows.map(row => ({
      ...this.mapRowToApiKey(row),
      creator_name: row.creator_name,
      creator_email: row.creator_email
    }));

    return { apiKeys, total };
  }

  /**
   * Crea una nueva API Key
   */
  async create(data: CreateApiKeyData, createdBy?: number): Promise<{ apiKey: ApiKeyWithCreator; plainKey: string }> {
    console.log('[API_KEY_REPO] Generando API Key...');
    const plainKey = ApiKeyRepository.generateApiKey();
    console.log('[API_KEY_REPO] Hasheando API Key...');
    const hashStart = Date.now();
    const keyHash = await ApiKeyRepository.hashApiKey(plainKey);
    console.log(`[API_KEY_REPO] Hash completado en ${Date.now() - hashStart}ms`);

    const query = `
      INSERT INTO api_keys (
        key_name, api_key, key_hash, description, created_by,
        expires_at, rate_limit_per_minute, rate_limit_per_hour,
        allowed_ips, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

    console.log('[API_KEY_REPO] Ejecutando INSERT en base de datos...');
    const insertStart = Date.now();
    const result = await executeQuery(query, [
      data.key_name,
      plainKey, // Guardamos la key en texto plano solo para referencia (se puede eliminar después)
      keyHash,
      data.description || null,
      createdBy || null,
      data.expires_at || null,
      data.rate_limit_per_minute || 60,
      data.rate_limit_per_hour || 1000,
      data.allowed_ips || null,
      metadataJson
    ]) as any;
    console.log(`[API_KEY_REPO] INSERT completado en ${Date.now() - insertStart}ms`);

    const insertId = result.insertId || result[0]?.insertId;
    console.log('[API_KEY_REPO] ID insertado:', insertId);

    // Obtener la API Key creada directamente sin JOIN para evitar timeouts
    console.log('[API_KEY_REPO] Obteniendo API Key creada...');
    const selectStart = Date.now();
    const basicQuery = `SELECT * FROM api_keys WHERE id = ? LIMIT 1`;
    const basicRows = await executeQuery(basicQuery, [insertId]) as DBApiKey[];
    console.log(`[API_KEY_REPO] SELECT completado en ${Date.now() - selectStart}ms`);
    
    if (basicRows.length === 0) {
      throw new Error('Error al crear API Key: no se pudo recuperar después de la inserción');
    }
    
    const row = basicRows[0];
    
    // Intentar obtener información del creador solo si created_by existe (sin bloquear)
    let creator_name: string | undefined = undefined;
    let creator_email: string | undefined = undefined;
    
    if (row.created_by) {
      try {
        console.log('[API_KEY_REPO] Obteniendo información del creador...');
        const userQuery = `SELECT username, email FROM users WHERE id = ? LIMIT 1`;
        const userRows = await executeQuery(userQuery, [row.created_by]) as Array<{ username?: string; email?: string }>;
        if (userRows.length > 0) {
          creator_name = userRows[0].username;
          creator_email = userRows[0].email;
        }
      } catch (error: any) {
        // Si falla, simplemente continuamos sin la información del creador
        console.warn('[API_KEY_REPO] No se pudo obtener información del creador:', error.message);
      }
    }
    
    console.log('[API_KEY_REPO] API Key creada exitosamente');
    
    const newApiKey: ApiKeyWithCreator = {
      ...this.mapRowToApiKey(row),
      creator_name,
      creator_email
    };

    return {
      apiKey: newApiKey,
      plainKey // Retornamos la key en texto plano solo una vez
    };
  }

  /**
   * Actualiza una API Key
   */
  async update(id: number, data: UpdateApiKeyData): Promise<ApiKey> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.key_name !== undefined) {
      fields.push('key_name = ?');
      params.push(data.key_name);
    }

    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }

    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }

    if (data.expires_at !== undefined) {
      fields.push('expires_at = ?');
      params.push(data.expires_at || null);
    }

    if (data.rate_limit_per_minute !== undefined) {
      fields.push('rate_limit_per_minute = ?');
      params.push(data.rate_limit_per_minute);
    }

    if (data.rate_limit_per_hour !== undefined) {
      fields.push('rate_limit_per_hour = ?');
      params.push(data.rate_limit_per_hour);
    }

    if (data.allowed_ips !== undefined) {
      fields.push('allowed_ips = ?');
      params.push(data.allowed_ips || null);
    }

    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      params.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('API Key no encontrada');
      }
      return existing;
    }

    params.push(id);

    const query = `UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`;
    await executeQuery(query, params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Error al actualizar API Key');
    }

    return updated;
  }

  /**
   * Elimina una API Key (soft delete)
   */
  async delete(id: number): Promise<void> {
    await this.update(id, { is_active: false });
  }

  /**
   * Elimina permanentemente una API Key
   */
  async permanentDelete(id: number): Promise<void> {
    const query = `DELETE FROM api_keys WHERE id = ?`;
    await executeQuery(query, [id]);
  }

  /**
   * Registra el uso de una API Key
   */
  async logUsage(apiKeyId: number, data: {
    endpoint: string;
    method: string;
    ip_address?: string;
    user_agent?: string;
    response_status?: number;
    response_time_ms?: number;
  }): Promise<void> {
    const query = `
      INSERT INTO api_key_logs (
        api_key_id, endpoint, method, ip_address, user_agent,
        response_status, response_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await executeQuery(query, [
      apiKeyId,
      data.endpoint,
      data.method,
      data.ip_address || null,
      data.user_agent || null,
      data.response_status || null,
      data.response_time_ms || null
    ]);

    // Actualizar last_used_at
    await executeQuery(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = ?`,
      [apiKeyId]
    );
  }

  /**
   * Mapea una fila de la BD a un objeto ApiKey
   */
  private mapRowToApiKey(row: DBApiKey): ApiKey {
    return {
      id: row.id,
      key_name: row.key_name,
      api_key: '***HIDDEN***', // Nunca exponer la key real
      key_hash: row.key_hash,
      description: row.description || undefined,
      created_by: row.created_by || undefined,
      is_active: Boolean(Number(row.is_active) === 1 || row.is_active === true),
      last_used_at: row.last_used_at || undefined,
      expires_at: row.expires_at || undefined,
      rate_limit_per_minute: row.rate_limit_per_minute,
      rate_limit_per_hour: row.rate_limit_per_hour,
      allowed_ips: row.allowed_ips || undefined,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}


