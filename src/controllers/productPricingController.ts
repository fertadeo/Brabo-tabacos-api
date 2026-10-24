import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { ProductPricingService } from '../services/ProductPricingService';

export class ProductPricingController {
  private productPricingService: ProductPricingService;

  constructor() {
    this.productPricingService = new ProductPricingService();
  }

  /** GET /api/products/pricing/categories */
  public async getCategoriesForPricing(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active_only !== 'false';
      const categories = await this.productPricingService.getCategoriesForPricing(activeOnly);
      const response: ApiResponse = {
        success: true,
        message: 'Categorías con cantidad de productos para actualización de precios',
        data: { categories },
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      this.sendError(res, error, 'Error al obtener categorías para precios');
    }
  }

  /** POST /api/products/pricing/category-adjustment/preview */
  public async previewCategoryAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productPricingService.previewCategoryAdjustment({
        category_ids: this.parseCategoryIds(req.body.category_ids),
        percentage: Number(req.body.percentage),
        include_uncategorized: !!req.body.include_uncategorized,
        active_only: req.body.active_only !== false,
        preview_limit: req.body.preview_limit != null ? Number(req.body.preview_limit) : 10
      });
      res.status(200).json(result);
    } catch (error) {
      this.sendError(res, error, 'Error en vista previa por categoría', 400);
    }
  }

  /** POST /api/products/pricing/category-adjustment */
  public async applyCategoryAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productPricingService.applyCategoryAdjustment({
        category_ids: this.parseCategoryIds(req.body.category_ids),
        percentage: Number(req.body.percentage),
        include_uncategorized: !!req.body.include_uncategorized,
        active_only: req.body.active_only !== false,
        dry_run: !!req.body.dry_run,
        sync_to_woocommerce: !!req.body.sync_to_woocommerce
      });
      res.status(200).json(result);
    } catch (error) {
      this.sendError(res, error, 'Error al actualizar precios por categoría', 400);
    }
  }

  /** GET /api/products/pricing/dollar-rate */
  public async getDollarRate(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productPricingService.getDollarRateInfo();
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.status(200).json(result);
    } catch (error) {
      const status = error instanceof Error && error.message.includes('cotización') ? 503 : 500;
      this.sendError(res, error, 'Error al obtener cotización del dólar', status);
    }
  }

  /** POST /api/products/pricing/dollar-adjustment/preview */
  public async previewDollarAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productPricingService.previewDollarAdjustment({
        active_only: req.body.active_only !== false,
        preview_limit: req.body.preview_limit != null ? Number(req.body.preview_limit) : 10
      });
      res.status(200).json(result);
    } catch (error) {
      const status = error instanceof Error && error.message.includes('cotización') ? 503 : 500;
      this.sendError(res, error, 'Error en vista previa por dólar', status);
    }
  }

  /** POST /api/products/pricing/dollar-adjustment */
  public async applyDollarAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productPricingService.applyDollarAdjustment({
        active_only: req.body.active_only !== false,
        dry_run: !!req.body.dry_run,
        sync_to_woocommerce: !!req.body.sync_to_woocommerce
      });
      res.status(200).json(result);
    } catch (error) {
      const status = error instanceof Error && error.message.includes('cotización') ? 503 : 500;
      this.sendError(res, error, 'Error al aplicar ajuste por dólar', status);
    }
  }

  private parseCategoryIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  private sendError(res: Response, error: unknown, message: string, status = 500): void {
    console.error(message, error);
    const response: ApiResponse = {
      success: false,
      message,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    res.status(status).json(response);
  }
}
