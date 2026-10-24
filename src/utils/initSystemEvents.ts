import { executeQuery } from '../config/database';

/**
 * Crea la tabla system_events si no existe (idempotente al arrancar la API).
 */
export async function initializeSystemEventsTable(): Promise<void> {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS system_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_type ENUM('activity','error','alert') NOT NULL DEFAULT 'activity',
        severity ENUM('info','warning','error','critical') NOT NULL DEFAULT 'info',
        module VARCHAR(64) NOT NULL DEFAULT 'system',
        action VARCHAR(64) NOT NULL DEFAULT 'unknown',
        message TEXT NOT NULL,
        user_id INT UNSIGNED NULL,
        username VARCHAR(100) NULL,
        user_role VARCHAR(32) NULL,
        request_method VARCHAR(10) NULL,
        request_path VARCHAR(512) NULL,
        status_code SMALLINT UNSIGNED NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(512) NULL,
        metadata JSON NULL,
        duration_ms INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_event_type (event_type),
        INDEX idx_severity (severity),
        INDEX idx_module (module),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        INDEX idx_event_type_created (event_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla system_events verificada/creada');
  } catch (error: any) {
    console.error('❌ Error inicializando tabla system_events:', error.message);
  }
}
