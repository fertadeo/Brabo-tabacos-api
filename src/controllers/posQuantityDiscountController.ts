import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { PosQuantityDiscountService } from '../services/PosQuantityDiscountService';

export class PosQuantityDiscountController {
  private service = new PosQuantityDiscountService();

  /** GET /api/pos-quantity-discounts?active=1 */
  public async list(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly =
        req.query.active === '1' ||
        req.query.active === 'true' ||
        req.query.active_only === '1';
      const data = await this.service.list(activeOnly);
      const response: ApiResponse = {
        success: true,
        message: 'Descuentos escalonados POS',
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('GET /api/pos-quantity-discounts error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al listar descuentos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const created = await this.service.create({
        name: req.body.name,
        min_quantity: Number(req.body.min_quantity),
        discount_percent: Number(req.body.discount_percent),
        price_list_slug: req.body.price_list_slug ?? null,
        is_active: req.body.is_active !== false && req.body.is_active !== 0 && req.body.is_active !== '0',
        sort_order: req.body.sort_order !== undefined ? Number(req.body.sort_order) : 0
      });
      const response: ApiResponse = {
        success: true,
        message: 'Descuento creado',
        data: created,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(response);
    } catch (error) {
      console.error('POST /api/pos-quantity-discounts error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear descuento',
        error: msg,
        timestamp: new Date().toISOString()
      };
      res.status(msg.includes('obligatorio') || msg.includes('debe') || msg.includes('inválido') ? 400 : 500).json(response);
    }
  }

  public async update(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }
      const payload: Record<string, unknown> = {};
      if (req.body.name !== undefined) payload.name = req.body.name;
      if (req.body.min_quantity !== undefined) payload.min_quantity = Number(req.body.min_quantity);
      if (req.body.discount_percent !== undefined) payload.discount_percent = Number(req.body.discount_percent);
      if (req.body.price_list_slug !== undefined) payload.price_list_slug = req.body.price_list_slug;
      if (req.body.is_active !== undefined) {
        payload.is_active =
          req.body.is_active === true ||
          req.body.is_active === 1 ||
          req.body.is_active === '1' ||
          req.body.is_active === 'true';
      }
      if (req.body.sort_order !== undefined) payload.sort_order = Number(req.body.sort_order);

      const updated = await this.service.update(id, payload as any);
      const response: ApiResponse = {
        success: true,
        message: 'Descuento actualizado',
        data: updated,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('PUT /api/pos-quantity-discounts/:id error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const status = msg.includes('no encontrado') ? 404 : msg.includes('debe') || msg.includes('inválido') || msg.includes('obligatorio') ? 400 : 500;
      res.status(status).json({
        success: false,
        message: 'Error al actualizar descuento',
        error: msg,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async remove(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({
          success: false,
          message: 'ID inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }
      await this.service.remove(id);
      res.status(200).json({
        success: true,
        message: 'Descuento eliminado',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('DELETE /api/pos-quantity-discounts/:id error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(msg.includes('no encontrado') ? 404 : 500).json({
        success: false,
        message: 'Error al eliminar descuento',
        error: msg,
        timestamp: new Date().toISOString()
      });
    }
  }
}
