import { Request, Response } from 'express';
import { SaleService, FacturarVentaContext } from '../services/SaleService';
import { CreateSaleData, SaleFilters, UpdateSaleData } from '../entities/Sale';
import { ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/jwt';
import { resolveFacturadorApiKeyFromHeader } from '../utils/resolveFacturadorApiKey';

export class SaleController {
  private saleService: SaleService;

  constructor() {
    this.saleService = new SaleService();
  }

  // =====================================================
  // GESTIÓN DE VENTAS
  // =====================================================

  // POST /api/sales - Crear nueva venta
  public async createSale(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateSaleData = req.body;
      const rawId = (req as any).user?.id;
      const userId: number | null = typeof rawId === 'number' ? rawId : null;

      // Validaciones básicas
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'La venta debe incluir al menos un item',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!data.payment_method) {
        const response: ApiResponse = {
          success: false,
          message: 'El método de pago es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validar payment_details si el método es mixto
      if (data.payment_method === 'mixto') {
        if (!data.payment_details) {
          const response: ApiResponse = {
            success: false,
            message: 'Los detalles de pago son requeridos cuando el método es mixto',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
        }

        const total = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const paymentTotal = (data.payment_details.efectivo || 0) + 
                            (data.payment_details.tarjeta || 0) + 
                            (data.payment_details.transferencia || 0);

        if (Math.abs(paymentTotal - total) > 0.01) {
          const response: ApiResponse = {
            success: false,
            message: `El total de los métodos de pago (${paymentTotal}) no coincide con el total de la venta (${total})`,
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
        }
      }

      const result = await this.saleService.createSale(data, userId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.status(201).json(result);
    } catch (error) {
      console.error('Create sale controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/sales/:id - Obtener venta por ID
  public async getSaleById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.saleService.getSaleById(id);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get sale by ID controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/sales - Obtener todas las ventas con filtros
  public async getAllSales(req: Request, res: Response): Promise<void> {
    try {
      const rawIncludeItems = req.query.include_items;
      const includeItems =
        rawIncludeItems === 'true' || rawIncludeItems === '1';

      const filters: SaleFilters = {
        client_id: req.query.client_id ? parseInt(req.query.client_id as string, 10) : undefined,
        payment_method: req.query.payment_method as 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto' | undefined,
        sync_status: req.query.sync_status as 'pending' | 'synced' | 'error' | undefined,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        include_items: includeItems,
        include_facturacion_archived:
          req.query.include_facturacion_archived === 'true' ||
          req.query.include_facturacion_archived === '1'
      };

      const result = await this.saleService.getAllSales(filters);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get all sales controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/sales/:id - Corregir cliente o notas de una venta
  public async updateSale(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const data: UpdateSaleData = req.body;
      const rawId = (req as AuthenticatedRequest).user?.id;
      const userId: number | null = typeof rawId === 'number' ? rawId : null;
      const result = await this.saleService.updateSale(id, data, userId);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Update sale controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/sales/stats - Obtener estadísticas de ventas
  public async getSaleStats(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.saleService.getSaleStats();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get sale stats controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // =====================================================
  // SINCRONIZACIÓN CON WOOCOMMERCE
  // =====================================================

  // POST /api/sales/:id/sync - Sincronizar venta a WooCommerce
  public async syncSaleToWooCommerce(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.saleService.retrySync(id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Sync sale to WooCommerce controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/sales/:id/facturar/sugerencia - Defaults y tipo de comprobante recomendado
  public async getFacturarSugerencia(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const q = req.query;
      const overrides: { condicionIvaReceptor?: number; tipo?: number } = {};
      if (q.condicionIvaReceptor !== undefined) {
        overrides.condicionIvaReceptor = Number(q.condicionIvaReceptor);
      }
      if (q.tipo !== undefined) {
        overrides.tipo = Number(q.tipo);
      }

      const result = await this.saleService.getFacturarSugerencia(id, overrides);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Facturar sugerencia controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // GET /api/sales/:id/comprobante - Datos AFIP para vista/PDF (BD; refresh opcional desde facturador)
  public async getComprobante(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const resolved = resolveFacturadorApiKeyFromHeader(req);
      if (resolved.error) {
        res.status(resolved.error.status).json({
          success: false,
          message: resolved.error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
      const result = await this.saleService.getComprobanteVenta(id, {
        refresh,
        facturadorApiKey: resolved.apiKey
      });
      const status = result.success ? 200 : ((result.data as { status?: number })?.status ?? 404);
      res.status(status).json(result);
    } catch (error) {
      console.error('Get comprobante controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // POST /api/sales/:id/facturar - Emitir factura ARCA para una venta existente
  public async facturarVenta(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const resolved = resolveFacturadorApiKeyFromHeader(req);
      if (resolved.error) {
        res.status(resolved.error.status).json({
          success: false,
          message: resolved.error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const ctx: FacturarVentaContext = {
        facturadorApiKey: resolved.apiKey,
        audit: req.user
          ? {
              userId: req.user.id,
              username: req.user.username,
              role: req.user.role
            }
          : undefined
      };

      const result = await this.saleService.facturarVenta(id, req.body || {}, ctx);
      const status = result.success ? 200 : ((result.data as any)?.status || 400);
      res.status(status).json(result);
    } catch (error) {
      console.error('Facturar venta controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/sales/:id/nota-credito - Emitir nota de crédito ARCA por venta facturada
  public async emitirNotaCredito(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'ID de venta inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const resolved = resolveFacturadorApiKeyFromHeader(req);
      if (resolved.error) {
        res.status(resolved.error.status).json({
          success: false,
          message: resolved.error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const ctx: FacturarVentaContext = {
        facturadorApiKey: resolved.apiKey,
        audit: req.user
          ? {
              userId: req.user.id,
              username: req.user.username,
              role: req.user.role
            }
          : undefined
      };

      const result = await this.saleService.emitirNotaCredito(id, req.body || {}, ctx);
      const status = result.success ? 200 : ((result.data as { status?: number })?.status ?? 400);
      res.status(status).json(result);
    } catch (error) {
      console.error('Emitir nota de crédito controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /** POST /api/sales/facturacion-archive — ocultar o restaurar en facturación (superadmin). */
  public async setFacturacionArchived(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const saleIds = Array.isArray(req.body?.saleIds) ? req.body.saleIds : [];
      const archived = req.body?.archived !== false;
      const result = await this.saleService.setFacturacionArchivedForSales(saleIds, archived, {
        userId: req.user?.id ?? null,
        role: req.user?.role ?? null
      });
      const status = result.success ? 200 : ((result.data as { status?: number })?.status ?? 400);
      res.status(status).json(result);
    } catch (error) {
      console.error('Set facturacion archived controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
}
