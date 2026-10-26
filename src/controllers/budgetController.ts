import { Request, Response } from 'express';
import { BudgetService } from '../services/BudgetService';
import { CreateBudgetData, UpdateBudgetData, BudgetFilters, ConvertBudgetToSaleData } from '../entities/Budget';
import { ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/jwt';

export class BudgetController {
  private service: BudgetService;

  constructor() {
    this.service = new BudgetService();
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as CreateBudgetData;
      const result = await this.service.createBudget(data);
      res.status(result.success ? 201 : 400).json(result);
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Unknown error';
      res.status(500).json({
        success: false,
        message: detail || 'Error interno al crear presupuesto',
        error: detail,
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
        return;
      }
      const result = await this.service.getBudgetById(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async getAll(req: Request, res: Response): Promise<void> {
    try {
      const roIdRaw = req.query.repair_order_id ? parseInt(String(req.query.repair_order_id), 10) : NaN;
      const filters: BudgetFilters = {
        client_id: req.query.client_id ? parseInt(String(req.query.client_id), 10) : undefined,
        repair_order_id: Number.isFinite(roIdRaw) && roIdRaw >= 1 ? roIdRaw : undefined,
        status: req.query.status as BudgetFilters['status'],
        date_from: req.query.date_from ? String(req.query.date_from) : undefined,
        date_to: req.query.date_to ? String(req.query.date_to) : undefined,
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined
      };
      const result = await this.service.getAllBudgets(filters);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.service.getStats();
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
        return;
      }
      const data = req.body as UpdateBudgetData;
      const result = await this.service.updateBudget(id, data);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async remove(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
        return;
      }
      const result = await this.service.deleteBudget(id);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  public async send(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
      return;
    }
    const result = await this.service.sendBudget(id);
    res.status(result.success ? 200 : 400).json(result);
  }

  public async approve(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
      return;
    }
    const result = await this.service.approveBudget(id);
    res.status(result.success ? 200 : 400).json(result);
  }

  public async reject(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
      return;
    }
    const result = await this.service.rejectBudget(id);
    res.status(result.success ? 200 : 400).json(result);
  }

  public async expire(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
      return;
    }
    const result = await this.service.expireBudget(id);
    res.status(result.success ? 200 : 400).json(result);
  }

  public async convertToSale(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() });
        return;
      }
      const body = req.body as ConvertBudgetToSaleData;
      const rawId = (req as AuthenticatedRequest).user?.id;
      const userId: number | null = typeof rawId === 'number' ? rawId : null;
      const result = await this.service.convertToSale(id, body, userId);
      res.status(result.success ? 201 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error interno',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }
}
