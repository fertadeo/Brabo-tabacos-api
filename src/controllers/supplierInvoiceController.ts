import { Request, Response } from 'express';
import { SupplierInvoiceService } from '../services/SupplierInvoiceService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/jwt';

export class SupplierInvoiceController {
  private invoiceService: SupplierInvoiceService;

  constructor() {
    this.invoiceService = new SupplierInvoiceService();
  }

  // ========== INVOICE ENDPOINTS ==========

  // GET /api/supplier-invoices - Get all invoices with pagination and filters
  public async getAllInvoices(req: Request, res: Response): Promise<void> {
    try {
      const {
        page,
        limit,
        search,
        supplier_id,
        purchase_id,
        status,
        payment_status,
        date_from,
        date_to,
        all = 'false'
      } = req.query;

      const filters: any = {};

      if (search) filters.search = search;
      if (supplier_id) filters.supplier_id = parseInt(String(supplier_id));
      if (purchase_id) filters.purchase_id = parseInt(String(purchase_id));
      if (status) filters.status = status;
      if (payment_status) filters.payment_status = payment_status;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }

      const result = await this.invoiceService.getAllInvoices(filters);

      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'Todas las facturas obtenidas exitosamente' : 'Facturas obtenidas exitosamente',
        data: {
          invoices: result.invoices,
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
            message: 'Todas las facturas obtenidas (sin paginación)'
          })
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get invoices error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener facturas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/supplier-invoices/:id - Get invoice by ID
  public async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);

      if (isNaN(invoiceId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const invoice = await this.invoiceService.getInvoiceById(invoiceId);

      if (!invoice) {
        const response: ApiResponse = {
          success: false,
          message: 'Factura no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get invoice items
      const items = await this.invoiceService.getInvoiceItems(invoiceId);
      invoice.items = items;

      const response: ApiResponse = {
        success: true,
        message: 'Factura obtenida exitosamente',
        data: invoice,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get invoice error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-invoices - Create new invoice
  public async createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const invoice = await this.invoiceService.createInvoice(req.body, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Factura creada exitosamente',
        data: invoice,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create invoice error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-invoices/:id - Update invoice
  public async updateInvoice(req: Request, res: Response): Promise<void> {
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
      const invoiceId = parseInt(id);

      if (isNaN(invoiceId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const invoice = await this.invoiceService.updateInvoice(invoiceId, req.body);

      if (!invoice) {
        const response: ApiResponse = {
          success: false,
          message: 'Factura no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Factura actualizada exitosamente',
        data: invoice,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update invoice error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/supplier-invoices/:id - Delete invoice
  public async deleteInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoiceId = parseInt(id);

      if (isNaN(invoiceId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.invoiceService.deleteInvoice(invoiceId);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Factura no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Factura eliminada exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete invoice error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-invoices/:id/link-delivery-note - Link delivery note to invoice
  public async linkDeliveryNote(req: Request, res: Response): Promise<void> {
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
      const invoiceId = parseInt(id);
      const { delivery_note_id } = req.body;

      if (isNaN(invoiceId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const invoice = await this.invoiceService.linkDeliveryNote(invoiceId, delivery_note_id);

      const response: ApiResponse = {
        success: true,
        message: 'Remito vinculado exitosamente',
        data: invoice,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Link delivery note error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al vincular remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== INVOICE ITEMS ENDPOINTS ==========

  // GET /api/supplier-invoices/:invoiceId/items - Get invoice items
  public async getInvoiceItems(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const id = parseInt(invoiceId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const items = await this.invoiceService.getInvoiceItems(id);

      const response: ApiResponse = {
        success: true,
        message: 'Items de factura obtenidos exitosamente',
        data: items,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get invoice items error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener items de factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-invoices/:invoiceId/items - Create invoice item
  public async createInvoiceItem(req: Request, res: Response): Promise<void> {
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

      const { invoiceId } = req.params;
      const id = parseInt(invoiceId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.invoiceService.createInvoiceItem(id, req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Item de factura creado exitosamente',
        data: item,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create invoice item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear item de factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-invoices/:invoiceId/items/:itemId - Update invoice item
  public async updateInvoiceItem(req: Request, res: Response): Promise<void> {
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

      const { invoiceId, itemId } = req.params;
      const invoiceIdNum = parseInt(invoiceId);
      const itemIdNum = parseInt(itemId);

      if (isNaN(invoiceIdNum) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura o item inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.invoiceService.updateInvoiceItem(invoiceIdNum, itemIdNum, req.body);

      if (!item) {
        const response: ApiResponse = {
          success: false,
          message: 'Item de factura no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Item de factura actualizado exitosamente',
        data: item,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update invoice item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar item de factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/supplier-invoices/:invoiceId/items/:itemId - Delete invoice item
  public async deleteInvoiceItem(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId, itemId } = req.params;
      const invoiceIdNum = parseInt(invoiceId);
      const itemIdNum = parseInt(itemId);

      if (isNaN(invoiceIdNum) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de factura o item inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.invoiceService.deleteInvoiceItem(invoiceIdNum, itemIdNum);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Item de factura no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Item de factura eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete invoice item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar item de factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

