import { executeQuery } from '../config/database';
import { ApiKeyRepository } from '../repositories/ApiKeyRepository';
import crypto from 'crypto';

// Configuración de la API Key para n8n
const N8N_API_KEY_CONFIG = {
  key_name: 'n8n WooCommerce Sync',
  description: 'API Key para sincronización automática de productos desde WooCommerce mayorista con n8n',
  metadata: {
    integration: 'n8n',
    purpose: 'woocommerce_product_sync',
    store: 'mayorista'
  },
  rate_limit_per_minute: 60,
  rate_limit_per_hour: 1000
};

/**
 * Inicializa una API Key para n8n si no existe
 * Esta función es idempotente: solo crea la API key si no existe una activa
 */
export async function initializeN8nApiKey(): Promise<string | null> {
  try {
    // Verificar si ya existe una API Key activa para n8n
    const checkSql = `
      SELECT id, key_name, is_active 
      FROM api_keys 
      WHERE key_name = ? AND is_active = 1 
      LIMIT 1
    `;
    const existingKeys = await executeQuery(checkSql, [N8N_API_KEY_CONFIG.key_name]) as Array<{
      id: number;
      key_name: string;
      is_active: number;
    }>;

    if (existingKeys.length > 0) {
      console.log(`✅ API Key para n8n ya existe: ${existingKeys[0].key_name} (ID: ${existingKeys[0].id})`);
      console.log(`⚠️  Si necesitas una nueva API Key, desactiva la existente primero o usa el script generate-n8n-key.ts`);
      return null;
    }

    console.log('⚠️  No se encontró ninguna API Key activa para n8n.');
    console.log('🔨 Creando API Key para n8n...');

    // Generar la API Key usando el mismo método del repositorio
    const plainKey = ApiKeyRepository.generateApiKey();
    const keyHash = await ApiKeyRepository.hashApiKey(plainKey);

    // Insertar la API Key en la base de datos
    const insertSql = `
      INSERT INTO api_keys (
        key_name, 
        api_key, 
        key_hash, 
        description, 
        is_active, 
        expires_at,
        rate_limit_per_minute, 
        rate_limit_per_hour,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const metadataJson = JSON.stringify(N8N_API_KEY_CONFIG.metadata);

    await executeQuery(insertSql, [
      N8N_API_KEY_CONFIG.key_name,
      plainKey, // Guardamos en texto plano solo para referencia (se puede eliminar después)
      keyHash,
      N8N_API_KEY_CONFIG.description,
      true,
      null, // Sin expiración
      N8N_API_KEY_CONFIG.rate_limit_per_minute,
      N8N_API_KEY_CONFIG.rate_limit_per_hour,
      metadataJson
    ]);

    console.log('✅ API Key para n8n creada exitosamente!');
    console.log('📋 API Key generada:');
    console.log(`   ${plainKey}`);
    console.log('⚠️  IMPORTANTE: Guarda esta API Key de forma segura. No se mostrará nuevamente.');
    console.log('💡 Puedes encontrar esta API Key consultando directamente la base de datos o usando el endpoint GET /api/api-keys');

    return plainKey;

  } catch (error: any) {
    // Si la API Key ya existe (duplicate entry), no es un error crítico
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate entry')) {
      console.log('✅ API Key para n8n ya existe en la base de datos.');
    } else {
      console.error('❌ Error inicializando API Key para n8n:', error.message);
      // No lanzar el error para que el servidor pueda iniciar incluso si falla
    }
    return null;
  }
}
