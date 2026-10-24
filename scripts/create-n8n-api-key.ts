import dotenv from 'dotenv';
import { initializeN8nApiKey } from '../src/utils/initN8nApiKey';
import { testConnection } from '../src/config/database';

// Cargar variables de entorno
dotenv.config();

/**
 * Script standalone para crear una API Key para n8n
 * Uso: npx ts-node scripts/create-n8n-api-key.ts
 */
async function main() {
  console.log('🚀 Script para crear API Key de n8n\n');

  try {
    // Verificar conexión a la base de datos
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos. Verifica las variables de entorno.');
      process.exit(1);
    }

    console.log('✅ Conexión a la base de datos establecida\n');

    // Crear la API Key
    const apiKey = await initializeN8nApiKey();

    if (apiKey) {
      console.log('\n=== ✅ API KEY GENERADA EXITOSAMENTE ===\n');
      console.log('API Key:');
      console.log(apiKey);
      console.log('\n=== IMPORTANTE ===');
      console.log('⚠️  Guarda esta API Key de forma segura.');
      console.log('📝 Usa esta API Key en n8n para sincronizar productos desde WooCommerce.');
      console.log('🔗 Esta API Key se puede usar en el header X-API-Key de tus peticiones HTTP.\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  No se creó una nueva API Key.');
      console.log('💡 Si necesitas una nueva API Key, puedes:');
      console.log('   1. Desactivar la existente usando el endpoint DELETE /api/api-keys/:id');
      console.log('   2. O crear una nueva desde Postman (autenticado como admin)\n');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('❌ Error ejecutando el script:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar el script
main();
