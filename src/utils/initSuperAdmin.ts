import { executeQuery } from '../config/database';
import bcrypt from 'bcryptjs';

const DEFAULT_SUPERADMIN = {
  username: 'superadmin',
  email: process.env.SUPERADMIN_EMAIL || 'superadmin@brabotabacos.local',
  password: process.env.SUPERADMIN_PASSWORD || 'CambiarYa123!',
  firstName: 'Super',
  lastName: 'Admin',
  role: 'superadmin' as const,
};

/**
 * Crea el usuario superadmin si no existe (solo cuando INIT_SUPERADMIN_ON_START=true).
 * Rol oculto para desarrolladores; no visible en gestión de usuarios del admin.
 */
export async function initializeSuperAdminUser(): Promise<void> {
  try {
    const sql = `SELECT id, username FROM users WHERE role = ? AND is_active = 1 LIMIT 1`;
    const existing = await executeQuery(sql, ['superadmin']) as Array<{ id: number; username: string }>;

    if (existing.length > 0) {
      console.log(`✅ Usuario superadmin ya existe: ${existing[0].username} (ID: ${existing[0].id})`);
      return;
    }

    console.log('🔨 Creando usuario superadmin para desarrollo...');
    const passwordHash = await bcrypt.hash(DEFAULT_SUPERADMIN.password, 10);

    const insertSql = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await executeQuery(insertSql, [
      DEFAULT_SUPERADMIN.username,
      DEFAULT_SUPERADMIN.email,
      passwordHash,
      DEFAULT_SUPERADMIN.firstName,
      DEFAULT_SUPERADMIN.lastName,
      DEFAULT_SUPERADMIN.role,
      true,
    ]);

    console.log('✅ Usuario superadmin creado exitosamente');
    console.log(`📋 Credenciales: Username: ${DEFAULT_SUPERADMIN.username}, Password: ${DEFAULT_SUPERADMIN.password}`);
    console.log('⚠️  Cambia la contraseña y desactiva INIT_SUPERADMIN_ON_START en producción.');
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate entry')) {
      console.log('✅ Usuario superadmin ya existe en la base de datos.');
    } else {
      console.error('❌ Error inicializando usuario superadmin:', error.message);
    }
  }
}
