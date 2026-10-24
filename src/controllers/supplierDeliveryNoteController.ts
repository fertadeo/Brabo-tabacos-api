import { Request, Response } from 'express';
import { SupplierDeliveryNoteService } from '../services/SupplierDeliveryNoteService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/jwt';

export class SupplierDeliveryNoteController {
  private deliveryNoteService: SupplierDeliveryNoteService;

  constructor() {
    this.deliveryNoteService = new SupplierDeliveryNoteService();
  }

  // ========== DELIVERY NOTE ENDPOINTS ==========

  // GET /api/supplier-delivery-notes - Get all delivery notes with pagination and filters
  public async getAllDeliveryNotes(req: Request, res: Response): Promise<void> {
    try {
      const {
        page,
        limit,
        search,
        supplier_id,
        purchase_id,
        invoice_id,
        status,
        all = 'false'
      } = req.query;

      const filters: any = {};

      if (search) filters.search = search;
      if (supplier_id) filters.supplier_id = parseInt(String(supplier_id));
      if (purchase_id) filters.purchase_id = parseInt(String(purchase_id));
      if (invoice_id) filters.invoice_id = parseInt(String(invoice_id));
      if (status) filters.status = status;

      if (all !== 'true') {
        filters.page = parseInt(String(page), 10) || 1;
        filters.limit = parseInt(String(limit), 10) || 10;
      }

      const result = await this.deliveryNoteService.getAllDeliveryNotes(filters);

      const response: ApiResponse<any> = {
        success: true,
        message: all === 'true' ? 'Todos los remitos obtenidos exitosamente' : 'Remitos obtenidos exitosamente',
        data: {
          delivery_notes: result.delivery_notes,
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
            message: 'Todos los remitos obtenidos (sin paginación)'
          })
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get delivery notes error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener remitos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/supplier-delivery-notes/:id - Get delivery note by ID
  public async getDeliveryNoteById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deliveryNoteId = parseInt(id);

      if (isNaN(deliveryNoteId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deliveryNote = await this.deliveryNoteService.getDeliveryNoteById(deliveryNoteId);

      if (!deliveryNote) {
        const response: ApiResponse = {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get delivery note items
      const items = await this.deliveryNoteService.getDeliveryNoteItems(deliveryNoteId);
      deliveryNote.items = items;

      const response: ApiResponse = {
        success: true,
        message: 'Remito obtenido exitosamente',
        data: deliveryNote,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get delivery note error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-delivery-notes - Create new delivery note
  public async createDeliveryNote(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const deliveryNote = await this.deliveryNoteService.createDeliveryNote(req.body, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Remito creado exitosamente',
        data: deliveryNote,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create delivery note error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-delivery-notes/:id - Update delivery note
  public async updateDeliveryNote(req: Request, res: Response): Promise<void> {
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
      const deliveryNoteId = parseInt(id);

      if (isNaN(deliveryNoteId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deliveryNote = await this.deliveryNoteService.updateDeliveryNote(deliveryNoteId, req.body);

      if (!deliveryNote) {
        const response: ApiResponse = {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Remito actualizado exitosamente',
        data: deliveryNote,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update delivery note error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/supplier-delivery-notes/:id - Delete delivery note
  public async deleteDeliveryNote(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deliveryNoteId = parseInt(id);

      if (isNaN(deliveryNoteId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.deliveryNoteService.deleteDeliveryNote(deliveryNoteId);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Remito eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete delivery note error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-delivery-notes/:id/link-invoice - Link invoice to delivery note
  public async linkInvoice(req: Request, res: Response): Promise<void> {
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
      const deliveryNoteId = parseInt(id);
      const { invoice_id } = req.body;

      if (isNaN(deliveryNoteId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deliveryNote = await this.deliveryNoteService.linkInvoice(deliveryNoteId, invoice_id);

      const response: ApiResponse = {
        success: true,
        message: 'Factura vinculada exitosamente',
        data: deliveryNote,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Link invoice error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al vincular factura',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // ========== DELIVERY NOTE ITEMS ENDPOINTS ==========

  // GET /api/supplier-delivery-notes/:deliveryNoteId/items - Get delivery note items
  public async getDeliveryNoteItems(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryNoteId } = req.params;
      const id = parseInt(deliveryNoteId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const items = await this.deliveryNoteService.getDeliveryNoteItems(id);

      const response: ApiResponse = {
        success: true,
        message: 'Items de remito obtenidos exitosamente',
        data: items,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get delivery note items error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al obtener items de remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/supplier-delivery-notes/:deliveryNoteId/items - Create delivery note item
  public async createDeliveryNoteItem(req: Request, res: Response): Promise<void> {
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

      const { deliveryNoteId } = req.params;
      const id = parseInt(deliveryNoteId);

      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.deliveryNoteService.createDeliveryNoteItem(id, req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Item de remito creado exitosamente',
        data: item,
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create delivery note item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al crear item de remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/supplier-delivery-notes/:deliveryNoteId/items/:itemId - Update delivery note item
  public async updateDeliveryNoteItem(req: Request, res: Response): Promise<void> {
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

      const { deliveryNoteId, itemId } = req.params;
      const deliveryNoteIdNum = parseInt(deliveryNoteId);
      const itemIdNum = parseInt(itemId);

      if (isNaN(deliveryNoteIdNum) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito o item inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const item = await this.deliveryNoteService.updateDeliveryNoteItem(deliveryNoteIdNum, itemIdNum, req.body);

      if (!item) {
        const response: ApiResponse = {
          success: false,
          message: 'Item de remito no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Item de remito actualizado exitosamente',
        data: item,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update delivery note item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al actualizar item de remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/supplier-delivery-notes/:deliveryNoteId/items/:itemId - Delete delivery note item
  public async deleteDeliveryNoteItem(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryNoteId, itemId } = req.params;
      const deliveryNoteIdNum = parseInt(deliveryNoteId);
      const itemIdNum = parseInt(itemId);

      if (isNaN(deliveryNoteIdNum) || isNaN(itemIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito o item inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const deleted = await this.deliveryNoteService.deleteDeliveryNoteItem(deliveryNoteIdNum, itemIdNum);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Item de remito no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Item de remito eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Delete delivery note item error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al eliminar item de remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

