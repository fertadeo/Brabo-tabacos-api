import bcrypt from 'bcryptjs';
import { UserRepository, DBUser } from '../repositories/UserRepository';
import { PermissionRepository } from '../repositories/PermissionRepository';

export type CreateUserInput = {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: DBUser['role'];
  isActive?: boolean;
};

const ALLOWED_ROLES: DBUser['role'][] = [
  'admin', 'manager', 'employee', 'viewer',
  'gerencia', 'ventas', 'logistica', 'finanzas'
];

export const UserService = {
  isRoleAllowed(role: string): role is DBUser['role'] {
    return ALLOWED_ROLES.includes(role as DBUser['role']);
  },

  async createUser(input: CreateUserInput): Promise<number> {
    if (!this.isRoleAllowed(input.role)) {
      throw new Error('Invalid role');
    }
    const password_hash = await bcrypt.hash(input.password, 10);
    const id = await UserRepository.create({
      username: input.username,
      email: input.email,
      password_hash,
      first_name: input.firstName,
      last_name: input.lastName,
      role: input.role,
      is_active: input.isActive ?? true
    });

    // ✅ IMPORTANTE: Los permisos del rol se asignan automáticamente
    // El sistema obtiene los permisos del usuario desde la tabla role_permissions
    // basándose en el rol asignado. No es necesario asignar permisos individuales
    // a cada usuario porque el método getPermissionsByUser() automáticamente:
    // 1. Obtiene todos los permisos del rol desde role_permissions
    // 2. Combina con permisos directos (excepcionales) de user_permissions
    // 
    // Ejemplo: Si se crea un usuario con rol "logistica", automáticamente tendrá
    // todos los permisos asignados al rol "logistica" en la tabla role_permissions
    
    // Verificar que el rol tenga permisos asignados (solo para logging/debug)
    const rolePermissions = await PermissionRepository.getPermissionsByRole(input.role);
    if (rolePermissions.length === 0 && input.role !== 'admin') {
      // Admin tiene todos los permisos automáticamente, otros roles deben tener permisos asignados
      console.warn(`⚠️ El rol ${input.role} no tiene permisos asignados en role_permissions`);
    } else {
      console.log(`✅ Usuario creado con rol "${input.role}" - ${rolePermissions.length} permisos asignados automáticamente`);
    }

    return id;
  }
};
