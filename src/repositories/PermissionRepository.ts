import { executeQuery } from "../config/database";
import { RowDataPacket } from "mysql2";

export interface DBPermission extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  module: string;
  description: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface DBRolePermission extends RowDataPacket {
  id: number;
  role: string;
  permission_id: number;
  created_at: string;
}

export interface DBUserPermission extends RowDataPacket {
  id: number;
  user_id: number;
  permission_id: number;
  granted_by: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PermissionRepository = {
  // Permisos
  async findAll(filters?: { module?: string; is_active?: boolean }): Promise<DBPermission[]> {
    let sql = `SELECT * FROM permissions WHERE 1=1`;
    const params: any[] = [];

    if (filters?.module) {
      sql += ` AND module = ?`;
      params.push(filters.module);
    }

    if (filters?.is_active !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(filters.is_active);
    }

    sql += ` ORDER BY module, name`;
    const rows = await executeQuery(sql, params);
    return rows as DBPermission[];
  },

  async findById(id: number): Promise<DBPermission | null> {
    const sql = `SELECT * FROM permissions WHERE id = ? LIMIT 1`;
    const rows = await executeQuery(sql, [id]);
    const arr = rows as DBPermission[];
    return arr && arr.length ? arr[0] : null;
  },

  async findByCode(code: string): Promise<DBPermission | null> {
    const sql = `SELECT * FROM permissions WHERE code = ? LIMIT 1`;
    const rows = await executeQuery(sql, [code]);
    const arr = rows as DBPermission[];
    return arr && arr.length ? arr[0] : null;
  },

  async create(permission: {
    name: string;
    code: string;
    module: string;
    description?: string;
    is_active?: boolean;
  }): Promise<number> {
    const sql = `INSERT INTO permissions (name, code, module, description, is_active) 
                 VALUES (?, ?, ?, ?, ?)`;
    const result: any = await executeQuery(sql, [
      permission.name,
      permission.code,
      permission.module,
      permission.description || null,
      permission.is_active ?? true
    ]);
    return result.insertId as number;
  },

  async update(id: number, permission: {
    name?: string;
    code?: string;
    module?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (permission.name !== undefined) {
      updates.push(`name = ?`);
      params.push(permission.name);
    }
    if (permission.code !== undefined) {
      updates.push(`code = ?`);
      params.push(permission.code);
    }
    if (permission.module !== undefined) {
      updates.push(`module = ?`);
      params.push(permission.module);
    }
    if (permission.description !== undefined) {
      updates.push(`description = ?`);
      params.push(permission.description);
    }
    if (permission.is_active !== undefined) {
      updates.push(`is_active = ?`);
      params.push(permission.is_active);
    }

    if (updates.length === 0) return false;

    params.push(id);
    const sql = `UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(sql, params);
    return true;
  },

  async delete(id: number): Promise<boolean> {
    const sql = `DELETE FROM permissions WHERE id = ?`;
    await executeQuery(sql, [id]);
    return true;
  },

  // Role Permissions
  async getPermissionsByRole(role: string): Promise<DBPermission[]> {
    const sql = `
      SELECT p.* 
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ? AND p.is_active = 1
      ORDER BY p.module, p.name
    `;
    const rows = await executeQuery(sql, [role]);
    return rows as DBPermission[];
  },

  async assignPermissionToRole(role: string, permissionId: number): Promise<boolean> {
    try {
      const sql = `INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)`;
      await executeQuery(sql, [role, permissionId]);
      return true;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false; // Ya existe
      }
      throw error;
    }
  },

  async removePermissionFromRole(role: string, permissionId: number): Promise<boolean> {
    const sql = `DELETE FROM role_permissions WHERE role = ? AND permission_id = ?`;
    await executeQuery(sql, [role, permissionId]);
    return true;
  },

  async removeAllPermissionsFromRole(role: string): Promise<boolean> {
    const sql = `DELETE FROM role_permissions WHERE role = ?`;
    await executeQuery(sql, [role]);
    return true;
  },

  // User Permissions
  async getPermissionsByUser(userId: number): Promise<DBPermission[]> {
    const sql = `
      SELECT DISTINCT p.* 
      FROM permissions p
      WHERE p.is_active = 1
      AND (
        -- Permisos del rol del usuario
        p.id IN (
          SELECT rp.permission_id 
          FROM role_permissions rp
          INNER JOIN users u ON rp.role = u.role
          WHERE u.id = ?
        )
        OR
        -- Permisos directos del usuario (no expirados)
        p.id IN (
          SELECT up.permission_id 
          FROM user_permissions up
          WHERE up.user_id = ? 
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
        )
      )
      ORDER BY p.module, p.name
    `;
    const rows = await executeQuery(sql, [userId, userId]);
    return rows as DBPermission[];
  },

  async getUserHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count
      FROM permissions p
      WHERE p.code = ? AND p.is_active = 1
      AND (
        -- Permisos del rol del usuario
        p.id IN (
          SELECT rp.permission_id 
          FROM role_permissions rp
          INNER JOIN users u ON rp.role = u.role
          WHERE u.id = ? AND u.is_active = 1
        )
        OR
        -- Permisos directos del usuario (no expirados)
        p.id IN (
          SELECT up.permission_id 
          FROM user_permissions up
          WHERE up.user_id = ? 
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
        )
      )
    `;
    const rows = await executeQuery(sql, [permissionCode, userId, userId]);
    const arr = rows as Array<{ count: number }>;
    return arr && arr.length > 0 && arr[0].count > 0;
  },

  async assignPermissionToUser(
    userId: number,
    permissionId: number,
    grantedBy: number | null = null,
    expiresAt: string | null = null
  ): Promise<boolean> {
    try {
      const sql = `INSERT INTO user_permissions (user_id, permission_id, granted_by, expires_at) 
                   VALUES (?, ?, ?, ?)`;
      await executeQuery(sql, [userId, permissionId, grantedBy, expiresAt]);
      return true;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false; // Ya existe
      }
      throw error;
    }
  },

  async removePermissionFromUser(userId: number, permissionId: number): Promise<boolean> {
    const sql = `DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?`;
    await executeQuery(sql, [userId, permissionId]);
    return true;
  },

  async getUserDirectPermissions(userId: number): Promise<Array<DBPermission & { expires_at: string | null; granted_by: number | null }>> {
    const sql = `
      SELECT p.*, up.expires_at, up.granted_by
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ? AND (up.expires_at IS NULL OR up.expires_at > NOW())
      ORDER BY p.module, p.name
    `;
    const rows = await executeQuery(sql, [userId]);
    return rows as Array<DBPermission & { expires_at: string | null; granted_by: number | null }>;
  }
};

