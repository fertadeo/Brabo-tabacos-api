import { ApiKeyRepository } from '../repositories/ApiKeyRepository';
import { ApiKey, CreateApiKeyData, UpdateApiKeyData, ApiKeyWithCreator } from '../entities/ApiKey';

export class ApiKeyService {
  private apiKeyRepository: ApiKeyRepository;

  constructor() {
    this.apiKeyRepository = new ApiKeyRepository();
  }

  /**
   * Crea una nueva API Key
   */
  async createApiKey(data: CreateApiKeyData, createdBy?: number): Promise<{ apiKey: ApiKeyWithCreator; plainKey: string }> {
    // Validaciones
    if (!data.key_name || data.key_name.trim().length === 0) {
      throw new Error('El nombre de la API Key es requerido');
    }

    if (data.key_name.length > 100) {
      throw new Error('El nombre de la API Key no puede exceder 100 caracteres');
    }

    // Validar fecha de expiración si se proporciona
    if (data.expires_at) {
      const expiryDate = new Date(data.expires_at);
      if (isNaN(expiryDate.getTime())) {
        throw new Error('Fecha de expiración inválida');
      }
      if (expiryDate <= new Date()) {
        throw new Error('La fecha de expiración debe ser futura');
      }
    }

    // Validar rate limits
    if (data.rate_limit_per_minute !== undefined && data.rate_limit_per_minute < 1) {
      throw new Error('El límite de peticiones por minuto debe ser al menos 1');
    }

    if (data.rate_limit_per_hour !== undefined && data.rate_limit_per_hour < 1) {
      throw new Error('El límite de peticiones por hora debe ser al menos 1');
    }

    return await this.apiKeyRepository.create(data, createdBy);
  }

  /**
   * Obtiene todas las API Keys con filtros
   */
  async getAllApiKeys(options: {
    page?: number;
    limit?: number;
    is_active?: boolean;
    search?: string;
  } = {}): Promise<{ apiKeys: ApiKeyWithCreator[]; total: number; page: number; limit: number }> {
    const result = await this.apiKeyRepository.findAll(options);
    
    return {
      ...result,
      page: options.page || 1,
      limit: options.limit || 10
    };
  }

  /**
   * Obtiene una API Key por ID
   */
  async getApiKeyById(id: number): Promise<ApiKeyWithCreator> {
    const apiKey = await this.apiKeyRepository.findById(id);
    
    if (!apiKey) {
      throw new Error('API Key no encontrada');
    }

    return apiKey;
  }

  /**
   * Actualiza una API Key
   */
  async updateApiKey(id: number, data: UpdateApiKeyData): Promise<ApiKeyWithCreator> {
    const existing = await this.apiKeyRepository.findById(id);
    
    if (!existing) {
      throw new Error('API Key no encontrada');
    }

    // Validaciones
    if (data.key_name !== undefined) {
      if (!data.key_name || data.key_name.trim().length === 0) {
        throw new Error('El nombre de la API Key no puede estar vacío');
      }
      if (data.key_name.length > 100) {
        throw new Error('El nombre de la API Key no puede exceder 100 caracteres');
      }
    }

    if (data.expires_at !== undefined && data.expires_at) {
      const expiryDate = new Date(data.expires_at);
      if (isNaN(expiryDate.getTime())) {
        throw new Error('Fecha de expiración inválida');
      }
      if (expiryDate <= new Date()) {
        throw new Error('La fecha de expiración debe ser futura');
      }
    }

    if (data.rate_limit_per_minute !== undefined && data.rate_limit_per_minute < 1) {
      throw new Error('El límite de peticiones por minuto debe ser al menos 1');
    }

    if (data.rate_limit_per_hour !== undefined && data.rate_limit_per_hour < 1) {
      throw new Error('El límite de peticiones por hora debe ser al menos 1');
    }

    await this.apiKeyRepository.update(id, data);
    return await this.getApiKeyById(id);
  }

  /**
   * Desactiva una API Key (soft delete)
   */
  async deactivateApiKey(id: number): Promise<void> {
    await this.updateApiKey(id, { is_active: false });
  }

  /**
   * Activa una API Key
   */
  async activateApiKey(id: number): Promise<void> {
    await this.updateApiKey(id, { is_active: true });
  }

  /**
   * Elimina permanentemente una API Key
   */
  async deleteApiKey(id: number): Promise<void> {
    const existing = await this.apiKeyRepository.findById(id);
    
    if (!existing) {
      throw new Error('API Key no encontrada');
    }

    await this.apiKeyRepository.permanentDelete(id);
  }

  /**
   * Valida una API Key y retorna la información si es válida
   */
  async validateApiKey(apiKey: string): Promise<ApiKey | null> {
    return await this.apiKeyRepository.findByApiKey(apiKey);
  }

  /**
   * Registra el uso de una API Key
   */
  async logApiKeyUsage(apiKeyId: number, data: {
    endpoint: string;
    method: string;
    ip_address?: string;
    user_agent?: string;
    response_status?: number;
    response_time_ms?: number;
  }): Promise<void> {
    await this.apiKeyRepository.logUsage(apiKeyId, data);
  }
}




