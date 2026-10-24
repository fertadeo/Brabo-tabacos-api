import { Request, Response } from 'express';
import { RepairOrderService } from '../services/RepairOrderService';
import { CreateRepairOrderData, UpdateRepairOrderData, RepairOrderFilters, RepairOrderStatus } from '../entities/RepairOrder';
import { ApiResponse } from '../types';

export class RepairOrderController {
  private service: RepairOrderService;

  constructor() {
    this.service = new RepairOrderService();
  }

  private userId(req: Request): number | null {
    const raw = (req as any).user?.id;
    return typeof raw === 'number' ? raw : null;
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters: RepairOrderFilters = {
        status: req.query.status as RepairOrderStatus | undefined,
        client_id: req.query.client_id ? parseInt(String(req.query.client_id), 10) : undefined,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined
      };
      const result = await this.service.getAll(filters);
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al listar órdenes',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.getById(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener orden',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateRepairOrderData = req.body;
      const result = await this.service.create(data, this.userId(req));
      res.status(result.success ? 201 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al crear orden',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const data: UpdateRepairOrderData = req.body;
      const result = await this.service.update(id, data);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar orden',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async getItems(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.getItems(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener ítems',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async addItem(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const productId = req.body.product_id ?? req.body.productId;
      const quantity = typeof req.body.quantity === 'number' ? req.body.quantity : parseInt(String(req.body.quantity), 10);
      const unitPrice = typeof req.body.unit_price === 'number' ? req.body.unit_price : parseFloat(String(req.body.unit_price ?? req.body.unitPrice ?? 0));
      if (productId == null || Number.isNaN(quantity) || Number.isNaN(unitPrice)) {
        res.status(400).json({
          success: false,
          message: 'Faltan product_id (o productId), quantity o unit_price (o unitPrice)',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }
      const result = await this.service.addItem(id, { product_id: Number(productId), quantity, unit_price: unitPrice });
      res.status(result.success ? 201 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al agregar ítem',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(id) || isNaN(itemId)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const { quantity, unit_price } = req.body;
      const result = await this.service.updateItem(id, itemId, { quantity, unit_price });
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar ítem',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(id) || isNaN(itemId)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.deleteItem(id, itemId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar ítem',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async sendBudget(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.sendBudget(id);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al enviar presupuesto',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async accept(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const daysToClaim = req.body?.days_to_claim != null ? parseInt(String(req.body.days_to_claim), 10) : undefined;
      const result = await this.service.accept(id, Number.isNaN(daysToClaim) ? undefined : daysToClaim);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al aceptar presupuesto',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.cancel(id);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al cancelar',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const status = req.body?.status as RepairOrderStatus;
      if (!status) {
        res.status(400).json({ success: false, message: 'status es requerido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.updateStatus(id, status);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async getAcceptanceDocument(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.getAcceptanceDocument(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener documento',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async getPayments(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const result = await this.service.getPayments(id);
      res.status(result.success ? 200 : 404).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener pagos',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async addPayment(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido', timestamp: new Date().toISOString() } as ApiResponse);
        return;
      }
      const { amount, method, payment_date, movement_type, notes } = req.body;
      const paymentDate = payment_date || new Date().toISOString();
      const movementType = (movement_type || 'cobro') as 'cobro' | 'devolucion';
      const result = await this.service.addPayment(
        id,
        Number(amount),
        method,
        paymentDate,
        this.userId(req),
        movementType,
        notes
      );
      res.status(result.success ? 201 : 400).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al registrar pago',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.service.getStats();
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  }
}
