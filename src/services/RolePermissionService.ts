import { PermissionRepository, DBPermission } from '../repositories/PermissionRepository';
import { UserRepository, DBUser } from '../repositories/UserRepository';

export interface PermissionInput {
  name: string;
  code: string;
  module: string;
  description?: string;
  is_active?: boolean;
}

export interface AssignPermissionInput {
  role?: string;
  userId?: number;
  permissionId: number;
  expiresAt?: string | null;
}

export const RolePermissionService = {
  // Permisos
  async getAllPermissions(filters?: { module?: string; is_active?: boolean }) {
    return await PermissionRepository.findAll(filters);
  },

  async getPermissionById(id: number) {
    const permission = await PermissionRepository.findById(id);
    if (!permission) {
      throw new Error('Permiso no encontrado');
    }
    return permission;
  },

  async getPermissionByCode(code: string) {
    const permission = await PermissionRepository.findByCode(code);
    if (!permission) {
      throw new Error('Permiso no encontrado');
    }
    return permission;
  },

  async createPermission(input: PermissionInput) {
    // Validar que el código no exista
    const existing = await PermissionRepository.findByCode(input.code);
    if (existing) {
      throw new Error('El código de permiso ya existe');
    }

    const id = await PermissionRepository.create(input);
    return await PermissionRepository.findById(id);
  },

  async updatePermission(id: number, input: Partial<PermissionInput>) {
    // Si se está actualizando el código, validar que no exista
    if (input.code) {
      const existing = await PermissionRepository.findByCode(input.code);
      if (existing && existing.id !== id) {
        throw new Error('El código de permiso ya existe');
      }
    }

    await PermissionRepository.update(id, input);
    return await PermissionRepository.findById(id);
  },

  async deletePermission(id: number) {
    const permission = await PermissionRepository.findById(id);
    if (!permission) {
      throw new Error('Permiso no encontrado');
    }
    await PermissionRepository.delete(id);
    return { success: true };
  },

  // Roles y Permisos
  async getPermissionsByRole(role: string) {
    // Validar que el rol sea válido
    const validRoles = ['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas'];
    if (!validRoles.includes(role)) {
      throw new Error('Rol inválido');
    }
    return await PermissionRepository.getPermissionsByRole(role);
  },

  async assignPermissionToRole(role: string, permissionId: number) {
    // Validar que el rol sea válido
    const validRoles = ['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas'];
    if (!validRoles.includes(role)) {
      throw new Error('Rol inválido');
    }

    // Validar que el permiso exista
    const permission = await PermissionRepository.findById(permissionId);
    if (!permission) {
      throw new Error('Permiso no encontrado');
    }

    const result = await PermissionRepository.assignPermissionToRole(role, permissionId);
    if (!result) {
      throw new Error('El permiso ya está asignado a este rol');
    }
    return { success: true, role, permissionId };
  },

  async removePermissionFromRole(role: string, permissionId: number) {
    await PermissionRepository.removePermissionFromRole(role, permissionId);
    return { success: true, role, permissionId };
  },

  async getRolePermissionsSummary() {
    const validRoles = ['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas'];
    const summary: Record<string, DBPermission[]> = {};

    for (const role of validRoles) {
      summary[role] = await PermissionRepository.getPermissionsByRole(role);
    }

    return summary;
  },

  // Usuarios y Permisos
  async getPermissionsByUser(userId: number) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const permissions = await PermissionRepository.getPermissionsByUser(userId);
    const rolePermissions = await PermissionRepository.getPermissionsByRole(user.role);
    const directPermissions = await PermissionRepository.getUserDirectPermissions(userId);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      permissions,
      rolePermissions,
      directPermissions
    };
  },

  async userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    return await PermissionRepository.getUserHasPermission(userId, permissionCode);
  },

  async assignPermissionToUser(input: AssignPermissionInput) {
    if (!input.userId && !input.role) {
      throw new Error('Debe especificar userId o role');
    }

    if (input.userId && input.role) {
      throw new Error('Debe especificar solo userId o role, no ambos');
    }

    // Validar que el permiso exista
    const permission = await PermissionRepository.findById(input.permissionId);
    if (!permission) {
      throw new Error('Permiso no encontrado');
    }

    if (input.userId) {
      // Asignar permiso directo a usuario
      const user = await UserRepository.findById(input.userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const result = await PermissionRepository.assignPermissionToUser(
        input.userId,
        input.permissionId,
        null,
        input.expiresAt || null
      );

      if (!result) {
        throw new Error('El permiso ya está asignado a este usuario');
      }

      return { success: true, userId: input.userId, permissionId: input.permissionId };
    } else if (input.role) {
      // Asignar permiso a rol
      return await this.assignPermissionToRole(input.role, input.permissionId);
    }

    throw new Error('Error en la asignación');
  },

  async removePermissionFromUser(userId: number, permissionId: number) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await PermissionRepository.removePermissionFromUser(userId, permissionId);
    return { success: true, userId, permissionId };
  },

  // Utilidades
  async getModulesList() {
    const permissions = await PermissionRepository.findAll({ is_active: true });
    const modules = new Set(permissions.map(p => p.module));
    return Array.from(modules).sort();
  }
};

