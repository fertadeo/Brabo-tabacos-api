import { Request, Response } from 'express';
import { AccruedExpenseService } from '../services/AccruedExpenseService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/jwt';

export class AccruedExpenseController {
  private expenseService: AccruedExpenseService;

  constructor() {
    this.expenseService = new AccruedExpenseService();
  }

  // ========== EXPENSE ENDPOINTS ==========

  // GET /api/accrued-expenses - Get all expenses with pagination and filters
  public async getAllExpenses(req: Request, res: Response): Promise<void> {
    try {
      const {
        page,
        limit,
        search,
        supplier_id,
        expense_type,
        category,
        status,
        date_from,
        date_to,
        all = 'false'
      } = req.query;

      const filters: any = {};

      if (search) filters.search = search;
      if (supplier_id) filters.supplier_id = parseInt(String(supplier_id));
      if (expense_type) filters.expense_type = expense_type;
      if (category) filters.category = category;
      if (status) filters.status = status;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }

      const result = await this.expenseService.getAllExpenses(filters);

      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'Todos los egresos devengados obtenidos exitosamente' : 'Egresos devengados obtenidos exitosamente',
        data: {
          expenses: result.expenses,
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
            message: 'Todos los egresos devengados obtenidos (sin paginación)'
          })
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get expenses error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener egresos devengados',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/accrued-expenses/:id - Get expense by ID
  public async getExpenseById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expenseId = parseInt(id);

      if (isNaN(expenseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de egreso devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const expense = await this.expenseService.getExpenseById(expenseId);

      if (!expense) {
        const response: ApiResponse = {
          success: false,
          message: 'Egreso devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Egreso devengado obtenido exitosamente',
        data: expense,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get expense error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener egreso devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/accrued-expenses - Create new expense
  public async createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const expense = await this.expenseService.createExpense(req.body, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Egreso devengado creado exitosamente',
        data: expense,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create expense error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear egreso devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/accrued-expenses/:id - Update expense
  public async updateExpense(req: Request, res: Response): Promise<void> {
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
      const expenseId = parseInt(id);

      if (isNaN(expenseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de egreso devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const expense = await this.expenseService.updateExpense(expenseId, req.body);

      if (!expense) {
        const response: ApiResponse = {
          success: false,
          message: 'Egreso devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Egreso devengado actualizado exitosamente',
        data: expense,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update expense error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar egreso devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/accrued-expenses/:id - Delete expense
  public async deleteExpense(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expenseId = parseInt(id);

      if (isNaN(expenseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de egreso devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.expenseService.deleteExpense(expenseId);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Egreso devengado no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Egreso devengado eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete expense error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar egreso devengado',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/accrued-expenses/:id/link-invoice - Link invoice to expense
  public async linkInvoiceToExpense(req: Request, res: Response): Promise<void> {
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
      const expenseId = parseInt(id);
      const { invoice_id } = req.body;

      if (isNaN(expenseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de egreso devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const expense = await this.expenseService.linkInvoiceToExpense(expenseId, invoice_id);

      const response: ApiResponse = {
        success: true,
        message: 'Factura vinculada exitosamente',
        data: expense,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Link invoice to expense error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al vincular factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/accrued-expenses/:id/update-payment-status - Update payment status
  public async updatePaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expenseId = parseInt(id);

      if (isNaN(expenseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de egreso devengado inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      await this.expenseService.updateExpensePaymentStatus(expenseId);

      const expense = await this.expenseService.getExpenseById(expenseId);

      const response: ApiResponse = {
        success: true,
        message: 'Estado de pago actualizado exitosamente',
        data: expense,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update payment status error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar estado de pago',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

