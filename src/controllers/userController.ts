import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/jwt';
import { UserRepository } from '../repositories/UserRepository';
import { ApiResponse } from '../types';
import { UserService } from '../services/UserService';
import bcrypt from 'bcryptjs';

export class UserController {
  // GET /api/users - Obtener todos los usuarios
  async getAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const { is_active, role } = req.query;
      const filters: { is_active?: boolean; role?: string } = {};

      if (is_active !== undefined) {
        filters.is_active = is_active === 'true' || is_active === '1';
      }

      if (role) {
        filters.role = role as string;
      }

      const users = await UserRepository.findAll({ ...filters, excludeHiddenRoles: true });

      // No retornar el password_hash
      const usersWithoutPassword = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active === 1 || user.is_active === true,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: usersWithoutPassword,
        timestamp: new Date().toISOString()
      };

      return res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener usuarios',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }
  }

  // GET /api/users/:id - Obtener usuario por ID
  async getUserById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const user = await UserRepository.findById(id);
      if (!user || user.role === 'superadmin') {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // No retornar el password_hash
      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active === 1 || user.is_active === true,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };

      const response: ApiResponse = {
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: userWithoutPassword,
        timestamp: new Date().toISOString()
      };

      return res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener usuario',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }
  }

  // POST /api/users - Crear nuevo usuario
  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      // Normalizar nombres de campos (aceptar camelCase, PascalCase y snake_case)
      // Nota: El middleware normalizeUserFields ya normaliza estos campos, pero mantenemos esto como respaldo
      const {
        username,
        email,
        password,
        firstName = req.body.firstName || req.body.FirstName || req.body.first_name,
        lastName = req.body.lastName || req.body.LastName || req.body.last_name,
        role,
        isActive = req.body.isActive !== undefined ? req.body.isActive : (req.body.is_active !== undefined ? req.body.is_active : true)
      } = req.body;

      // Validar campos requeridos
      if (!username || !email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos faltantes: username, email, password, firstName (o FirstName o first_name), lastName (o LastName o last_name), role',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Validar rol
      if (!UserService.isRoleAllowed(role)) {
        return res.status(400).json({
          success: false,
          message: `Rol inválido. Roles permitidos: admin, gerencia, ventas, logistica, finanzas, manager, employee, viewer`,
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Crear usuario
      const userId = await UserService.createUser({
        username,
        email,
        password,
        firstName,
        lastName,
        role,
        isActive: isActive !== undefined ? isActive : true
      });

      // Obtener el usuario creado
      const user = await UserRepository.findById(userId);
      if (!user) {
        return res.status(500).json({
          success: false,
          message: 'Usuario creado pero no se pudo recuperar',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Usuario creado exitosamente',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active === 1 || user.is_active === true,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        timestamp: new Date().toISOString()
      };

      return res.status(201).json(response);
    } catch (error: any) {
      let statusCode = 500;
      let message = 'Error al crear usuario';

      if (error.message?.toLowerCase().includes('duplicate') || 
          error.message?.toLowerCase().includes('unique')) {
        statusCode = 409;
        message = 'El nombre de usuario o email ya existe';
      } else if (error.message?.toLowerCase().includes('invalid')) {
        statusCode = 400;
        message = error.message;
      }

      const response: ApiResponse = {
        success: false,
        message,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      return res.status(statusCode).json(response);
    }
  }

  // PUT /api/users/:id - Actualizar usuario
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const { username, email, password, firstName, lastName, role, isActive } = req.body;

      // Verificar que el usuario existe
      const existingUser = await UserRepository.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Validar rol si se proporciona
      if (role && !UserService.isRoleAllowed(role)) {
        return res.status(400).json({
          success: false,
          message: `Rol inválido. Roles permitidos: admin, gerencia, ventas, logistica, finanzas, manager, employee, viewer`,
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Preparar datos para actualizar
      const updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (firstName !== undefined) updateData.first_name = firstName;
      if (lastName !== undefined) updateData.last_name = lastName;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.is_active = isActive;

      // Si hay password, hashearlo
      if (password) {
        updateData.password_hash = await bcrypt.hash(password, 10);
      }

      // Actualizar usuario
      await UserRepository.update(id, updateData);

      // Obtener el usuario actualizado
      const updatedUser = await UserRepository.findById(id);
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Usuario actualizado pero no se pudo recuperar',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role,
          isActive: updatedUser.is_active === 1 || updatedUser.is_active === true,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        },
        timestamp: new Date().toISOString()
      };

      return res.json(response);
    } catch (error: any) {
      let statusCode = 500;
      let message = 'Error al actualizar usuario';

      if (error.message?.toLowerCase().includes('duplicate') || 
          error.message?.toLowerCase().includes('unique')) {
        statusCode = 409;
        message = 'El nombre de usuario o email ya existe';
      }

      const response: ApiResponse = {
        success: false,
        message,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      return res.status(statusCode).json(response);
    }
  }

  // DELETE /api/users/:id - Eliminar usuario (soft delete)
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Verificar que el usuario existe
      const user = await UserRepository.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Soft delete: marcar como inactivo
      await UserRepository.update(id, { is_active: false });

      const response: ApiResponse = {
        success: true,
        message: 'Usuario eliminado exitosamente (marcado como inactivo)',
        timestamp: new Date().toISOString()
      };

      return res.json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar usuario',
        error: error.message,
        timestamp: new Date().toISOString()
      };

      return res.status(500).json(response);
    }
  }
}

