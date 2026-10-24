/**
 * Seed mínimo Brabo Tabacos: admin + categorías útiles.
 * Requiere BD migrada (db/schema.sql + migrations) y .env cargado.
 *
 * Uso: npm run seed:brabo
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  email: process.env.ADMIN_EMAIL || 'admin@brabotabacos.local',
  password: process.env.ADMIN_PASSWORD || 'CambiarYa123!',
  firstName: 'Admin',
  lastName: 'Brabo',
  role: 'admin',
};

const CATEGORIES = [
  { name: 'Cigarrillos', slug: 'cigarrillos', description: 'Cigarrillos' },
  { name: 'Tabaco para armar', slug: 'tabaco-armar', description: 'Tabaco para armar' },
  { name: 'Cigarros / puros', slug: 'cigarros', description: 'Cigarros y puros' },
  { name: 'Accesorios', slug: 'accesorios', description: 'Accesorios' },
  { name: 'Encendedores', slug: 'encendedores', description: 'Encendedores' },
  { name: 'Filtros / papeles', slug: 'filtros-papeles', description: 'Filtros y papeles' },
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brabo_tabacos',
  });

  try {
    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1"
    );
    if (!admins.length) {
      const hash = await bcrypt.hash(ADMIN.password, 10);
      await connection.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [ADMIN.username, ADMIN.email, hash, ADMIN.firstName, ADMIN.lastName, ADMIN.role]
      );
      console.log('✅ Admin creado:', ADMIN.username, ADMIN.email);
      console.log('   Password mock:', ADMIN.password);
    } else {
      console.log('ℹ️  Admin ya existe, skip');
    }

    // categories table shape may vary — try common columns
    const [tables] = await connection.query("SHOW TABLES LIKE 'categories'");
    if (!tables.length) {
      console.log('⚠️  Tabla categories no existe aún; corré schema/migrations primero');
      return;
    }
    const [cols] = await connection.query('SHOW COLUMNS FROM categories');
    const colNames = cols.map((c) => c.Field);
    for (const cat of CATEGORIES) {
      if (!colNames.includes('name')) break;
      const [ex] = await connection.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [cat.name]);
      if (ex.length) continue;
      const fields = ['name'];
      const values = [cat.name];
      if (colNames.includes('slug')) {
        fields.push('slug');
        values.push(cat.slug);
      }
      if (colNames.includes('description')) {
        fields.push('description');
        values.push(cat.description || cat.name);
      }
      if (colNames.includes('is_active')) {
        fields.push('is_active');
        values.push(1);
      }
      await connection.query(
        `INSERT INTO categories (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
        values
      );
      console.log('✅ Categoría:', cat.name);
    }
    console.log('✅ Seed Brabo mínimo listo');
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error('❌ seed failed:', e.message);
  process.exit(1);
});
