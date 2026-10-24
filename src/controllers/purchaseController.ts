import { Request, Response } from 'express';
import { PurchaseService } from '../services/PurchaseService';
import { ClientPadronService } from '../services/ClientPadronService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/jwt';
import { resolveFacturadorApiKeyFromHeader } from '../utils/resolveFacturadorApiKey';

export class PurchaseController {
  private purchaseService: PurchaseService;
  private padronService: ClientPadronService;

  constructor() {
    this.purchaseService = new PurchaseService();
    this.padronService = new ClientPadronService();
  }

  // ========== PURCHASE ENDPOINTS ==========

  // GET /api/purchases - Get all purchases with pagination and filters
  public async getAllPurchases(req: Request, res: Response): Promise<void> {
    try {
      console.log('=== getAllPurchases START ===');
      
      const { 
        page, 
        limit, 
        search, 
        status, 
        supplier_id,
        date_from,
        date_to,
        all = 'false'
      } = req.query;
      
      console.log('Query params:', { page, limit, search, status, supplier_id, date_from, date_to, all });
      
      const filters: any = {};
      
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (supplier_id) filters.supplier_id = parseInt(String(supplier_id));
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;
      
      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }
      
      const result = await this.purchaseService.getAllPurchases(filters);
      
      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'All purchases retrieved successfully' : 'Purchases retrieved successfully',
        data: {
          purchases: result.purchases,
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
            message: 'All purchases retrieved (no pagination applied)'
          })
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get purchases error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving purchases',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/purchases/:id - Get purchase by ID
  public async getPurchaseById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const purchaseId = parseInt(id);
      
      if (isNaN(purchaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }
      
      const purchase = await this.purchaseService.getPurchaseById(purchaseId);
      
      if (!purchase) {
        const response: ApiResponse = {
          success: false,
          message: 'Purchase not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase retrieved successfully',
        data: purchase,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get purchase by ID error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/purchases - Create new purchase
  public async createPurchase(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const purchase = await this.purchaseService.createPurchase(req.body);
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase created successfully',
        data: purchase,
        timestamp: new Date().toISOString()
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Create purchase error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error creating purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/purchases/:id - Update purchase
  public async updatePurchase(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const purchaseId = parseInt(id);
      
      if (isNaN(purchaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const purchase = await this.purchaseService.updatePurchase(purchaseId, req.body);
      
      if (!purchase) {
        const response: ApiResponse = {
          success: false,
          message: 'Purchase not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase updated successfully',
        data: purchase,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Update purchase error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error updating purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/purchases/:id - Delete purchase
  public async deletePurchase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const purchaseId = parseInt(id);
      
      if (isNaN(purchaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.purchaseService.deletePurchase(purchaseId);
      
      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Purchase not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase deleted successfully',
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete purchase error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error deleting purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== PURCHASE ITEMS ENDPOINTS ==========

  // GET /api/purchases/:id/items - Get purchase items
  public async getPurchaseItems(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const purchaseId = parseInt(id);
      
      if (isNaN(purchaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const items = await this.purchaseService.getPurchaseItems(purchaseId);
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase items retrieved successfully',
        data: items,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get purchase items error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving purchase items',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/purchases/:id/items - Create purchase item
  public async createPurchaseItem(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const purchaseId = parseInt(id);
      
      if (isNaN(purchaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.purchaseService.createPurchaseItem(purchaseId, req.body);
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase item created successfully',
        data: item,
        timestamp: new Date().toISOString()
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Create purchase item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error creating purchase item',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/purchases/:id/items/:itemId - Update purchase item
  public async updatePurchaseItem(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { id, itemId } = req.params;
      const purchaseId = parseInt(id);
      const itemIdNum = parseInt(itemId);
      
      if (isNaN(purchaseId) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID or item ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.purchaseService.updatePurchaseItem(purchaseId, itemIdNum, req.body);
      
      if (!item) {
        const response: ApiResponse = {
          success: false,
          message: 'Purchase item not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase item updated successfully',
        data: item,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Update purchase item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error updating purchase item',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/purchases/:id/items/:itemId - Delete purchase item
  public async deletePurchaseItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, itemId } = req.params;
      const purchaseId = parseInt(id);
      const itemIdNum = parseInt(itemId);
      
      if (isNaN(purchaseId) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid purchase ID or item ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.purchaseService.deletePurchaseItem(purchaseId, itemIdNum);
      
      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Purchase item not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase item deleted successfully',
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete purchase item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error deleting purchase item',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== SUPPLIER ENDPOINTS ==========

  // GET /api/purchases/suppliers - Get all suppliers
  public async getAllSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page, 
        limit, 
        search, 
        city,
        is_active,
        all = 'false'
      } = req.query;
      
      const filters: any = {};
      
      if (search) filters.search = search;
      if (city) filters.city = city;
      if (is_active !== undefined) filters.is_active = is_active === 'true';
      
      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }
      
      const result = await this.purchaseService.getAllSuppliers(filters);
      
      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'All suppliers retrieved successfully' : 'Suppliers retrieved successfully',
        data: {
          suppliers: result.suppliers,
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
            message: 'All suppliers retrieved (no pagination applied)'
          })
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get suppliers error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving suppliers',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/purchases/suppliers/:id - Get supplier by ID
  public async getSupplierById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const supplierId = parseInt(id);
      
      if (isNaN(supplierId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid supplier ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }
      
      const supplier = await this.purchaseService.getSupplierById(supplierId);
      
      if (!supplier) {
        const response: ApiResponse = {
          success: false,
          message: 'Supplier not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Supplier retrieved successfully',
        data: supplier,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get supplier by ID error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/purchases/suppliers - Create supplier
  public async createSupplier(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Normalizar valores booleanos: convertir números (1/0) a booleanos
      const normalizedData = { ...req.body };
      if ('has_account' in normalizedData) {
        if (typeof normalizedData.has_account === 'number') {
          normalizedData.has_account = normalizedData.has_account === 1;
        } else if (typeof normalizedData.has_account === 'string') {
          normalizedData.has_account = normalizedData.has_account === 'true' || normalizedData.has_account === '1';
        }
      }

      const supplier = await this.purchaseService.createSupplier(normalizedData);
      
      const response: ApiResponse = {
        success: true,
        message: 'Supplier created successfully',
        data: supplier,
        timestamp: new Date().toISOString()
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Create supplier error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error creating supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/purchases/suppliers/:id - Update supplier
  public async updateSupplier(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const supplierId = parseInt(id);
      
      if (isNaN(supplierId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid supplier ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Normalizar valores booleanos: convertir números (1/0) a booleanos
      const normalizedData = { ...req.body };
      if ('has_account' in normalizedData) {
        if (typeof normalizedData.has_account === 'number') {
          normalizedData.has_account = normalizedData.has_account === 1;
        } else if (typeof normalizedData.has_account === 'string') {
          normalizedData.has_account = normalizedData.has_account === 'true' || normalizedData.has_account === '1';
        }
      }
      if ('is_active' in normalizedData) {
        if (typeof normalizedData.is_active === 'number') {
          normalizedData.is_active = normalizedData.is_active === 1;
        } else if (typeof normalizedData.is_active === 'string') {
          normalizedData.is_active = normalizedData.is_active === 'true' || normalizedData.is_active === '1';
        }
      }

      const supplier = await this.purchaseService.updateSupplier(supplierId, normalizedData);
      
      if (!supplier) {
        const response: ApiResponse = {
          success: false,
          message: 'Supplier not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Supplier updated successfully',
        data: supplier,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Update supplier error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error updating supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/purchases/suppliers/:id - Delete supplier
  public async deleteSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const supplierId = parseInt(id);
      
      if (isNaN(supplierId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid supplier ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.purchaseService.deleteSupplier(supplierId);
      
      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Supplier not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Supplier deleted successfully',
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete supplier error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error deleting supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== STATISTICS ENDPOINTS ==========

  // GET /api/purchases/stats - Get purchase statistics
  public async getPurchaseStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.purchaseService.getPurchaseStats();
      
      const response: ApiResponse = {
        success: true,
        message: 'Purchase statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get purchase stats error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving purchase statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/purchases/suppliers/stats - Get supplier statistics
  public async getSupplierStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.purchaseService.getSupplierStats();
      
      const response: ApiResponse = {
        success: true,
        message: 'Supplier statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get supplier stats error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving supplier statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/purchases/suppliers/padron/:cuit — Consultar padrón ARCA (misma lógica que clientes)
  public async lookupSupplierPadron(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keyResult = resolveFacturadorApiKeyFromHeader(req);
      if (keyResult.error) {
        res.status(keyResult.error.status).json({
          success: false,
          message: keyResult.error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { cuit } = req.params;
      const cuitEmisor = req.query.cuitEmisor as string | undefined;
      const incluirCondicionIvaRaw = req.query.incluirCondicionIva as string | undefined;
      const incluirCondicionIva =
        incluirCondicionIvaRaw === undefined ||
        incluirCondicionIvaRaw === 'true' ||
        incluirCondicionIvaRaw === '1';
      const skipCache = req.query.skipCache === 'true' || req.query.skipCache === '1';

      const result = await this.padronService.lookupByCuit(cuit, {
        cuitEmisor,
        incluirCondicionIva,
        apiKey: keyResult.apiKey,
        skipCache,
      });

      if (!result.success) {
        const statusByError: Record<string, number> = {
          INVALID_CUIT: 400,
          CUIT_EMISOR_REQUERIDO: 400,
          FACTURADOR_NOT_CONFIGURED: 503,
          PADRON_SIN_DATOS: 404,
          QUOTA_FEATURE_DISABLED: 403,
          CUIT_NO_AUTORIZADO: 403,
          EMPRESA_NO_REGISTRADA: 422,
          PADRON_MULTI_SCOPE_FAILED: 502,
          AUTH_MISSING_KEY: 401,
          AUTH_INVALID_KEY: 401,
        };
        const status = statusByError[result.error ?? ''] ?? 502;
        res.status(status).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Lookup supplier padron error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error consultando padrón ARCA',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  }
}
