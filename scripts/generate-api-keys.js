const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Generar API Keys con el formato correcto
function generateApiKey() {
  return `fnec_${crypto.randomBytes(32).toString('base64').replace(/[+/=]/g, '')}`;
}

async function generateApiKeysForDB() {
  console.log('Generando API Keys...\n');
  
  // API Key para n8n
  const n8nKey = generateApiKey();
  const n8nHash = await bcrypt.hash(n8nKey, 10);
  
  // API Key para Monday.com
  const mondayKey = generateApiKey();
  const mondayHash = await bcrypt.hash(mondayKey, 10);
  
  console.log('=== API KEYS GENERADAS ===\n');
  console.log('1. API Key para n8n:');
  console.log(`   Key: ${n8nKey}`);
  console.log(`   Hash: ${n8nHash}\n`);
  
  console.log('2. API Key para Monday.com:');
  console.log(`   Key: ${mondayKey}`);
  console.log(`   Hash: ${mondayHash}\n`);
  
  console.log('=== QUERIES SQL ===\n');
  
  const sql = `
-- Crear tablas
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    rate_limit_per_minute INT DEFAULT 60,
    rate_limit_per_hour INT DEFAULT 1000,
    allowed_ips TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_api_key (api_key),
    INDEX idx_key_hash (key_hash),
    INDEX idx_is_active (is_active),
    INDEX idx_created_by (created_by),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_key_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key_id INT NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_status INT,
    response_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    INDEX idx_api_key_id (api_key_id),
    INDEX idx_created_at (created_at),
    INDEX idx_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar API Key para n8n
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
) VALUES (
    'n8n WooCommerce Sync',
    '${n8nKey}',
    '${n8nHash}',
    'API Key para sincronización automática de productos desde WooCommerce mayorista con n8n',
    TRUE,
    NULL,
    60,
    1000,
    '{"integration":"n8n","purpose":"woocommerce_product_sync","store":"mayorista"}'
);

-- Insertar API Key para Monday.com
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
) VALUES (
    'Monday.com Integration',
    '${mondayKey}',
    '${mondayHash}',
    'API Key para integración con Monday.com. Permite sincronización de datos entre el ERP y Monday.com para gestión de proyectos y tareas.',
    TRUE,
    '2026-12-31 23:59:59',
    60,
    1000,
    '{"integration":"monday","purpose":"project_management_sync","contact":"integrador@monday.com","company":"Monday.com","review_date":"2026-11-30","notes":"Vence el 31/12/2026 - Notificar al integrador 30 días antes para renovación"}'
);
`;
  
  console.log(sql);
  
  // Guardar en archivo
  const fs = require('fs');
  fs.writeFileSync('api-keys-insert.sql', sql);
  console.log('\n✅ Query SQL guardada en: api-keys-insert.sql');
  
  // Guardar las API Keys en texto plano
  const keysText = `API KEYS GENERADAS - GUARDAR DE FORMA SEGURA

1. API Key para n8n:
${n8nKey}

2. API Key para Monday.com:
${mondayKey}

⚠️ IMPORTANTE: Guarda estas API Keys de forma segura. No las compartas públicamente.
`;
  
  fs.writeFileSync('api-keys-plain.txt', keysText);
  console.log('✅ API Keys en texto plano guardadas en: api-keys-plain.txt');
}

generateApiKeysForDB().catch(console.error);

