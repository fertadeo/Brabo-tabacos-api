import { Request, Response } from 'express';
import { AccruedLiabilityService } from '../services/AccruedLiabilityService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/jwt';

export class AccruedLiabilityController {
  private liabilityService: AccruedLiabilityService;

  constructor() {
    this.liabilityService = new AccruedLiabilityService();
  }

  // ========== LIABILITY ENDPOINTS ==========

  // GET /api/accrued-liabilities - Get all liabilities with pagination and filters
  public async getAllLiabilities(req: Request, res: Response): Promise<void> {
    try {
      const {
        page,
        limit,
        search,
        liability_type,
        status,
        date_from,
        date_to,
        all = 'false'
      } = req.query;

      const filters: any = {};

      if (search) filters.search = search;
      if (liability_type) filters.liability_type = liability_type;
      if (status) filters.status = status;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }

      const result = await this.liabilityService.getAllLiabilities(filters);

      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'Todos los pasivos devengados obtenidos exitosamente' : 'Pasivos devengados obtenidos exitosamente',
        data: {
          liabilities: result.liabilities,
          ...(all !== 'true' && {
            pagination: {
              page: filters.page || 1,
              limit: filters.limit || 10,
              total: result.total,
              totalPages: Math.ceil(result.total / (filters.limit || 10))
            }
          }),
          ...(all === 'true' && {
            total: result.total,
            message: 'Todos los pasivos devengados obtenidos (sin paginación)'
          })
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get liabilities error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener pasivos devengados',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/accrued-liabilities/:id - Get liability by ID
  public async getLiabilityById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const liabilityId = parseInt(id);

      if (isNaN(liabilityId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const liability = await this.liabilityService.getLiabilityById(liabilityId);

      if (!liability) {
        const response: ApiResponse = {
          success: false,
          message: 'Pasivo devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get liability payments
      const payments = await this.liabilityService.getLiabilityPayments(liabilityId);
      liability.payments = payments;

      const response: ApiResponse = {
        success: true,
        message: 'Pasivo devengado obtenido exitosamente',
        data: liability,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener pasivo devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/accrued-liabilities - Create new liability
  public async createLiability(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const userId = req.user?.id;
      const liability = await this.liabilityService.createLiability(req.body, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Pasivo devengado creado exitosamente',
        data: liability,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear pasivo devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/accrued-liabilities/:id - Update liability
  public async updateLiability(req: Request, res: Response): Promise<void> {
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

      const { id } = req.params;
      const liabilityId = parseInt(id);

      if (isNaN(liabilityId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const liability = await this.liabilityService.updateLiability(liabilityId, req.body);

      if (!liability) {
        const response: ApiResponse = {
          success: false,
          message: 'Pasivo devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Pasivo devengado actualizado exitosamente',
        data: liability,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar pasivo devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/accrued-liabilities/:id - Delete liability
  public async deleteLiability(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const liabilityId = parseInt(id);

      if (isNaN(liabilityId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.liabilityService.deleteLiability(liabilityId);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Pasivo devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Pasivo devengado eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar pasivo devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== PAYMENT ENDPOINTS ==========

  // GET /api/accrued-liabilities/:id/payments - Get liability payments
  public async getLiabilityPayments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const liabilityId = parseInt(id);

      if (isNaN(liabilityId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const payments = await this.liabilityService.getLiabilityPayments(liabilityId);

      const response: ApiResponse = {
        success: true,
        message: 'Pagos obtenidos exitosamente',
        data: payments,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get liability payments error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener pagos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/accrued-liabilities/:id/link-payment - Link payment to liability
  public async linkPaymentToLiability(req: Request, res: Response): Promise<void> {
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

      const { id } = req.params;
      const liabilityId = parseInt(id);
      const { payment_id, amount } = req.body;

      if (isNaN(liabilityId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const linkedPayment = await this.liabilityService.linkPaymentToLiability(liabilityId, payment_id, amount);

      const response: ApiResponse = {
        success: true,
        message: 'Pago vinculado exitosamente',
        data: linkedPayment,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Link payment to liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al vincular pago',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/accrued-liabilities/:id/payments/:paymentId - Unlink payment from liability
  public async unlinkPaymentFromLiability(req: Request, res: Response): Promise<void> {
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

      const { id, paymentId } = req.params;
      const liabilityId = parseInt(id);
      const paymentIdNum = parseInt(paymentId);

      if (isNaN(liabilityId) || isNaN(paymentIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pasivo devengado o pago inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const unlinked = await this.liabilityService.unlinkPaymentFromLiability(liabilityId, paymentIdNum);

      if (!unlinked) {
        const response: ApiResponse = {
          success: false,
          message: 'El pago no está vinculado a este pasivo',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Pago desvinculado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Unlink payment from liability error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al desvincular pago',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

