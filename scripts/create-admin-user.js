const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Credenciales por defecto del usuario admin
const DEFAULT_ADMIN = {
  username: 'admin',
  email: process.env.ADMIN_EMAIL || 'admin@brabotabacos.local',
  password: process.env.ADMIN_PASSWORD || 'CambiarYa123!',
  firstName: 'Administrador',
  lastName: 'Sistema',
  role: 'admin'
};

async function createAdminUser() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brabo_tabacos'
  });

  try {
    console.log('🔍 Verificando si existe un usuario admin...');
    
    // Verificar si ya existe un usuario admin
    const [existingAdmins] = await connection.query(
      'SELECT id, username FROM users WHERE role = ? AND is_active = 1 LIMIT 1',
      ['admin']
    );

    if (existingAdmins.length > 0) {
      console.log('✅ Ya existe un usuario admin en el sistema:');
      console.log(`   Username: ${existingAdmins[0].username}`);
      console.log(`   ID: ${existingAdmins[0].id}`);
      console.log('   No se creará un nuevo usuario admin.');
      return;
    }

    console.log('⚠️  No se encontró ningún usuario admin activo.');
    console.log('🔨 Creando usuario admin por defecto...');

    // Hashear la contraseña
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    // Insertar el usuario admin
    const [result] = await connection.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_ADMIN.username,
        DEFAULT_ADMIN.email,
        passwordHash,
        DEFAULT_ADMIN.firstName,
        DEFAULT_ADMIN.lastName,
        DEFAULT_ADMIN.role,
        true
      ]
    );

    console.log('✅ Usuario admin creado exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log(`   Username: ${DEFAULT_ADMIN.username}`);
    console.log(`   Password: ${DEFAULT_ADMIN.password}`);
    console.log(`   Email: ${DEFAULT_ADMIN.email}`);
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login por seguridad.');
    console.log('\n🔗 Puedes hacer login en: POST /api/auth/login');
    console.log(`   Body: { "username": "${DEFAULT_ADMIN.username}", "password": "${DEFAULT_ADMIN.password}" }`);

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('✅ Ya existe un usuario con ese username o email.');
      console.log('   El usuario admin ya está creado.');
    } else {
      console.error('❌ Error creando usuario admin:', error.message);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

// Ejecutar el script
createAdminUser().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
