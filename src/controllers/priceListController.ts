import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { PriceListService } from '../services/PriceListService';

export class PriceListController {
  private service = new PriceListService();

  /** GET /api/price-lists */
  public async getAll(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = String(req.query.all || '').trim() === '1';
      const data = await this.service.getAll(!includeInactive);
      const response: ApiResponse = {
        success: true,
        message: 'Listas de precio',
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('GET /api/price-lists error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al listar listas de precio',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}
