import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/jwt';
import { RolePermissionService } from '../services/RolePermissionService';
import { ApiResponse } from '../types';

// RolePermissionController - Controlador para gestión de roles y permisos
export class RolePermissionController {
  // =====================================================
  // PERMISOS
  // =====================================================

  async getAllPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { module, is_active } = req.query;
      const filters: { module?: string; is_active?: boolean } = {};

      if (module) filters.module = module as string;
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true' || is_active === '1';
      }

      const permissions = await RolePermissionService.getAllPermissions(filters);

      const response: ApiResponse = {
        success: true,
        message: 'Permisos obtenidos exitosamente',
        data: permissions,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener permisos',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  async getPermissionById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const permission = await RolePermissionService.getPermissionById(id);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso obtenido exitosamente',
        data: permission,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Permiso no encontrado' ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener permiso',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async createPermission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, code, module, description, is_active } = req.body;

      if (!name || !code || !module) {
        res.status(400).json({
          success: false,
          message: 'name, code y module son requeridos',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const permission = await RolePermissionService.createPermission({
        name,
        code,
        module,
        description,
        is_active
      });

      const response: ApiResponse = {
        success: true,
        message: 'Permiso creado exitosamente',
        data: permission,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error: any) {
      const statusCode = error.message.includes('ya existe') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear permiso',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async updatePermission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const { name, code, module, description, is_active } = req.body;
      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (module !== undefined) updateData.module = module;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      const permission = await RolePermissionService.updatePermission(id, updateData);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso actualizado exitosamente',
        data: permission,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Permiso no encontrado' ? 404 : 
                         error.message.includes('ya existe') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar permiso',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async deletePermission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      await RolePermissionService.deletePermission(id);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Permiso no encontrado' ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar permiso',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // =====================================================
  // ROLES Y PERMISOS
  // =====================================================

  async getAllRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const roles = [
        { code: 'admin', name: 'Administrador', description: 'Acceso completo al sistema' },
        { code: 'gerencia', name: 'Gerencia', description: 'Personal gerencial con gestión operativa' },
        { code: 'ventas', name: 'Ventas', description: 'Personal del área de ventas' },
        { code: 'logistica', name: 'Logística', description: 'Personal del área de logística e inventario' },
        { code: 'finanzas', name: 'Finanzas', description: 'Personal del área financiera' },
        { code: 'manager', name: 'Manager', description: 'Gerentes de área' },
        { code: 'employee', name: 'Empleado', description: 'Empleados generales' },
        { code: 'viewer', name: 'Visualizador', description: 'Usuarios de solo lectura' }
      ];

      const response: ApiResponse = {
        success: true,
        message: 'Roles obtenidos exitosamente',
        data: roles,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener roles',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  async getPermissionsByRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { role } = req.params;
      const permissions = await RolePermissionService.getPermissionsByRole(role);

      const response: ApiResponse = {
        success: true,
        message: `Permisos del rol ${role} obtenidos exitosamente`,
        data: permissions,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Rol inválido' ? 400 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener permisos del rol',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async assignPermissionToRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { role } = req.params;
      const { permission_id } = req.body;

      if (!permission_id) {
        res.status(400).json({
          success: false,
          message: 'permission_id es requerido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const result = await RolePermissionService.assignPermissionToRole(role, permission_id);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso asignado al rol exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Rol inválido' || error.message === 'Permiso no encontrado' ? 400 :
                         error.message.includes('ya está asignado') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al asignar permiso al rol',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async removePermissionFromRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { role, permissionId } = req.params;
      const permission_id = parseInt(permissionId);

      if (isNaN(permission_id)) {
        res.status(400).json({
          success: false,
          message: 'ID de permiso inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const result = await RolePermissionService.removePermissionFromRole(role, permission_id);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso removido del rol exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al remover permiso del rol',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  async getRolePermissionsSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const summary = await RolePermissionService.getRolePermissionsSummary();

      const response: ApiResponse = {
        success: true,
        message: 'Resumen de permisos por rol obtenido exitosamente',
        data: summary,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener resumen de permisos',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // =====================================================
  // USUARIOS Y PERMISOS
  // =====================================================

  async getPermissionsByUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: 'ID de usuario inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const data = await RolePermissionService.getPermissionsByUser(userId);

      const response: ApiResponse = {
        success: true,
        message: 'Permisos del usuario obtenidos exitosamente',
        data,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener permisos del usuario',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async assignPermissionToUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { permission_id, role, user_id, expires_at } = req.body;

      if (!permission_id) {
        res.status(400).json({
          success: false,
          message: 'permission_id es requerido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      if (!role && !user_id) {
        res.status(400).json({
          success: false,
          message: 'Debe especificar role o user_id',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const result = await RolePermissionService.assignPermissionToUser({
        permissionId: permission_id,
        role,
        userId: user_id,
        expiresAt: expires_at || null
      });

      const response: ApiResponse = {
        success: true,
        message: 'Permiso asignado exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error: any) {
      const statusCode = error.message.includes('no encontrado') ? 404 :
                         error.message.includes('ya está asignado') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al asignar permiso',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  async removePermissionFromUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const permissionId = parseInt(req.params.permissionId);

      if (isNaN(userId) || isNaN(permissionId)) {
        res.status(400).json({
          success: false,
          message: 'IDs inválidos',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      const result = await RolePermissionService.removePermissionFromUser(userId, permissionId);

      const response: ApiResponse = {
        success: true,
        message: 'Permiso removido del usuario exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error al remover permiso del usuario',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // =====================================================
  // UTILIDADES
  // =====================================================

  async getModulesList(req: AuthenticatedRequest, res: Response) {
    try {
      const modules = await RolePermissionService.getModulesList();

      const response: ApiResponse = {
        success: true,
        message: 'Módulos obtenidos exitosamente',
        data: modules,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener módulos',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

