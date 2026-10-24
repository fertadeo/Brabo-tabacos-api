const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runAuthMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mfcomputers',
    multipleStatements: true // Permite ejecutar múltiples statements
  });

  try {
    console.log('📦 Ejecutando migración de autenticación (refresh_tokens)...');
    
    const migrationPath = path.join(__dirname, '../src/database/migration_auth.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Dividir el SQL en statements individuales
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Ejecutando ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await connection.query(statement + ';');
          console.log(`✅ Statement ${i + 1}/${statements.length} ejecutado`);
        } catch (error) {
          // Ignorar errores de "table already exists" o "duplicate entry" o "index already exists"
          if (error.code !== 'ER_TABLE_EXISTS_ERROR' && 
              error.code !== 'ER_DUP_ENTRY' &&
              error.code !== 'ER_DUP_KEYNAME' &&
              !error.message.includes('already exists') &&
              !error.message.includes('Duplicate key name')) {
            console.error(`❌ Error en statement ${i + 1}:`, error.message);
            throw error;
          } else {
            console.log(`⚠️  Statement ${i + 1} ya existe (ignorado)`);
          }
        }
      }
    }
    
    console.log('✅ Migración de autenticación completada exitosamente!');
    console.log('📊 Tabla creada:');
    console.log('   - refresh_tokens');
    console.log('📋 Índices creados:');
    console.log('   - idx_refresh_tokens_user');
    console.log('   - idx_refresh_tokens_expires');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runAuthMigration();
