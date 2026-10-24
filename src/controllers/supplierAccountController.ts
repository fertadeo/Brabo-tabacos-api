import { Request, Response } from 'express';
import { SupplierAccountService } from '../services/SupplierAccountService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';

export class SupplierAccountController {
  private accountService: SupplierAccountService;

  constructor() {
    this.accountService = new SupplierAccountService();
  }

  // ========== ACCOUNT ENDPOINTS ==========

  // GET /api/supplier-accounts/:supplierId - Get account by supplier ID
  public async getAccountBySupplierId(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { supplierId } = req.params;
      const id = parseInt(supplierId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de proveedor inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const account = await this.accountService.getAccountBySupplierId(id);

      const response: ApiResponse = {
        success: true,
        message: 'Cuenta de proveedor obtenida exitosamente',
        data: account,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get account error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener cuenta de proveedor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/supplier-accounts/:supplierId/summary - Get account summary
  public async getAccountSummary(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { supplierId } = req.params;
      const id = parseInt(supplierId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de proveedor inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const {
        page,
        limit,
        movement_type,
        date_from,
        date_to
      } = req.query;

      const filters: any = {};

      if (page) filters.page = parseInt(String(page), 10);
      if (limit) filters.limit = parseInt(String(limit), 10);
      if (movement_type) filters.movement_type = movement_type;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const summary = await this.accountService.getAccountSummary(id, filters);

      const response: ApiResponse = {
        success: true,
        message: 'Resumen de cuenta obtenido exitosamente',
        data: summary,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get account summary error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener resumen de cuenta',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-accounts/:supplierId/credit-limit - Update credit limit
  public async updateCreditLimit(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { supplierId } = req.params;
      const id = parseInt(supplierId);
      const { credit_limit } = req.body;

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de proveedor inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const account = await this.accountService.updateCreditLimit(id, credit_limit);

      const response: ApiResponse = {
        success: true,
        message: 'Límite de crédito actualizado exitosamente',
        data: account,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update credit limit error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar límite de crédito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-accounts/:supplierId/sync - Sync account balances
  public async syncAccountBalances(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { supplierId } = req.params;
      const id = parseInt(supplierId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de proveedor inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const account = await this.accountService.syncAccountBalances(id);

      const response: ApiResponse = {
        success: true,
        message: 'Balances sincronizados exitosamente',
        data: account,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Sync account balances error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al sincronizar balances',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== MOVEMENT ENDPOINTS ==========

  // GET /api/supplier-accounts/:supplierId/movements - Get account movements
  public async getMovements(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { supplierId } = req.params;
      const id = parseInt(supplierId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de proveedor inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const {
        page,
        limit,
        movement_type,
        date_from,
        date_to
      } = req.query;

      const filters: any = {};

      if (page) filters.page = parseInt(String(page), 10);
      if (limit) filters.limit = parseInt(String(limit), 10);
      if (movement_type) filters.movement_type = movement_type;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const result = await this.accountService.getMovements(id, filters);

      const response: ApiResponse = {
        success: true,
        message: 'Movimientos obtenidos exitosamente',
        data: {
          movements: result.movements,
          pagination: {
            page: filters.page || 1,
            limit: filters.limit || 50,
            total: result.total,
            totalPages: Math.ceil(result.total / (filters.limit || 50))
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get movements error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener movimientos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/supplier-accounts/movements/:movementId - Get movement by ID
  public async getMovementById(req: Request, res: Response): Promise<void> {
    try {
      const { movementId } = req.params;
      const id = parseInt(movementId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de movimiento inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const movement = await this.accountService.getMovementById(id);

      if (!movement) {
        const response: ApiResponse = {
          success: false,
          message: 'Movimiento no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Movimiento obtenido exitosamente',
        data: movement,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get movement error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener movimiento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-accounts/movements - Create movement
  public async createMovement(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const movement = await this.accountService.createMovement(req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Movimiento creado exitosamente',
        data: movement,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create movement error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear movimiento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-accounts/movements/:movementId - Update movement
  public async updateMovement(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Error de validación',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { movementId } = req.params;
      const id = parseInt(movementId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de movimiento inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const movement = await this.accountService.updateMovement(id, req.body);

      if (!movement) {
        const response: ApiResponse = {
          success: false,
          message: 'Movimiento no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Movimiento actualizado exitosamente',
        data: movement,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update movement error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar movimiento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/supplier-accounts/movements/:movementId - Delete movement
  public async deleteMovement(req: Request, res: Response): Promise<void> {
    try {
      const { movementId } = req.params;
      const id = parseInt(movementId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de movimiento inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.accountService.deleteMovement(id);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Movimiento no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Movimiento eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete movement error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar movimiento',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

