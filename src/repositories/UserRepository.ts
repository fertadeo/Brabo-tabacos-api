import { executeQuery } from "../config/database";
import { RowDataPacket } from "mysql2";
import type { UserRole } from "../constants/roles";

export interface DBUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
}

export const UserRepository = {
  async findByUsername(username: string): Promise<DBUser | null> {
    const sql = `SELECT * FROM users WHERE username = ? LIMIT 1`;
    const rows = await executeQuery(sql, [username]);
    const arr = rows as DBUser[];
    return arr && arr.length ? arr[0] : null;
  },

  async findById(id: number): Promise<DBUser | null> {
    const sql = `SELECT * FROM users WHERE id = ? LIMIT 1`;
    const rows = await executeQuery(sql, [id]);
    const arr = rows as DBUser[];
    return arr && arr.length ? arr[0] : null;
  },

  async countAll(): Promise<number> {
    const sql = `SELECT COUNT(*) as cnt FROM users`;
    const rows = await executeQuery(sql);
    const arr = rows as Array<{ cnt: number }>;
    return arr && arr.length ? arr[0].cnt : 0;
  },

  async findAll(filters?: { is_active?: boolean; role?: string; excludeHiddenRoles?: boolean }): Promise<DBUser[]> {
    let sql = `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE 1=1`;
    const params: any[] = [];

    if (filters?.excludeHiddenRoles) {
      sql += ` AND role NOT IN ('superadmin')`;
    }

    if (filters?.is_active !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(filters.is_active);
    }

    if (filters?.role) {
      sql += ` AND role = ?`;
      params.push(filters.role);
    }

    sql += ` ORDER BY created_at DESC`;
    const rows = await executeQuery(sql, params);
    return rows as DBUser[];
  },

  async create(user: { username: string; email: string; password_hash: string; first_name: string; last_name: string; role: DBUser['role']; is_active?: boolean }): Promise<number> {
    const sql = `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const result: any = await executeQuery(sql, [user.username, user.email, user.password_hash, user.first_name, user.last_name, user.role, user.is_active ?? true]);
    return result.insertId as number;
  },

  async update(id: number, updates: Partial<{ username: string; email: string; password_hash: string; first_name: string; last_name: string; role: DBUser['role']; is_active: boolean }>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(updates.password_hash);
    }
    if (updates.first_name !== undefined) {
      fields.push('first_name = ?');
      values.push(updates.first_name);
    }
    if (updates.last_name !== undefined) {
      fields.push('last_name = ?');
      values.push(updates.last_name);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return; // No hay nada que actualizar
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await executeQuery(sql, values);
  }
};
