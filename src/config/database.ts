import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  queueLimit: number;
  waitForConnections: boolean;
  enableKeepAlive: boolean;
  keepAliveInitialDelay: number;
}

const dbPoolSize = Number(process.env.DB_POOL_SIZE ?? 5);

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'brabo_tabacos',
  connectionLimit: Number.isFinite(dbPoolSize) && dbPoolSize > 0 ? dbPoolSize : 5,
  queueLimit: 50,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool (idleTimeout/maxIdle: liberar sockets idle ante wait_timeout del server)
const pool: Pool = mysql.createPool({
  ...dbConfig,
  maxIdle: 2,
  idleTimeout: 60_000,
});

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Execute query with error handling
export const executeQuery = async (
  query: string,
  params: any[] = [],
  connection?: PoolConnection
): Promise<any> => {
  try {
    const executor: Pool | PoolConnection = connection ?? pool;
    const [results] = await executor.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Get a connection from the pool
export const getConnection = async () => {
  return await pool.getConnection();
};

// Close all connections
export const closeConnections = async (): Promise<void> => {
  await pool.end();
  console.log('Database connections closed');
};

export default pool;
