import { Request, Response } from 'express';
import { LogisticsService } from '../services/LogisticsService';
import { CreateRemitoData, UpdateRemitoData, RemitoFilters, CreateTrazabilidadData } from '../entities/Remito';
import { ApiResponse } from '../types';

export class LogisticsController {
  private logisticsService: LogisticsService;

  constructor() {
    this.logisticsService = new LogisticsService();
  }

  // =====================================================
  // GESTIÓN DE REMITOS
  // =====================================================

  // POST /api/logistics/remitos - Crear nuevo remito
  public async createRemito(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateRemitoData = req.body;
      const userId = (req as any).user?.id || 1; // TODO: Obtener del JWT

      const result = await this.logisticsService.createRemito(data, userId);
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Create remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/remitos/:id - Obtener remito por ID
  public async getRemitoById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.getRemitoById(id);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get remito by ID controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/remitos/number/:number - Obtener remito por número
  public async getRemitoByNumber(req: Request, res: Response): Promise<void> {
    try {
      const remitoNumber = req.params.number;
      
      if (!remitoNumber) {
        const response: ApiResponse = {
          success: false,
          message: 'Número de remito requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.getRemitoByNumber(remitoNumber);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get remito by number controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/remitos - Obtener todos los remitos con filtros
  public async getAllRemitos(req: Request, res: Response): Promise<void> {
    try {
      const filters: RemitoFilters = {
        status: req.query.status as string,
        remito_type: req.query.remito_type as string,
        client_id: req.query.client_id ? parseInt(req.query.client_id as string, 10) : undefined,
        order_id: req.query.order_id ? parseInt(req.query.order_id as string, 10) : undefined,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        transport_company: req.query.transport_company as string,
        tracking_number: req.query.tracking_number as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      };

      const result = await this.logisticsService.getAllRemitos(filters);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get all remitos controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/logistics/remitos/:id - Actualizar remito
  public async updateRemito(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const data: UpdateRemitoData = req.body;
      const userId = (req as any).user?.id || 1; // TODO: Obtener del JWT

      const result = await this.logisticsService.updateRemito(id, data, userId);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Update remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/logistics/remitos/:id - Eliminar remito
  public async deleteRemito(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.deleteRemito(id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Delete remito controller error:', error);
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
  // GESTIÓN DE TRAZABILIDAD
  // =====================================================

  // POST /api/logistics/trazabilidad - Crear entrada de trazabilidad
  public async createTrazabilidadEntry(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateTrazabilidadData = req.body;

      const result = await this.logisticsService.createTrazabilidadEntry(data);
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Create trazabilidad entry controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/remitos/:id/trazabilidad - Obtener trazabilidad de un remito
  public async getTrazabilidadByRemito(req: Request, res: Response): Promise<void> {
    try {
      const remitoId = parseInt(req.params.id, 10);
      
      if (isNaN(remitoId)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.getTrazabilidadByRemito(remitoId);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get trazabilidad by remito controller error:', error);
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
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  // GET /api/logistics/stats - Obtener estadísticas del módulo
  public async getLogisticsStats(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.logisticsService.getRemitoStats();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get logistics stats controller error:', error);
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
  // CONFIGURACIÓN DEL MÓDULO
  // =====================================================

  // GET /api/logistics/zones - Obtener zonas de entrega
  public async getDeliveryZones(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.logisticsService.getDeliveryZones();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get delivery zones controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/transport-companies - Obtener empresas de transporte
  public async getTransportCompanies(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.logisticsService.getTransportCompanies();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get transport companies controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/config - Obtener configuración del módulo
  public async getLogisticsConfig(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.logisticsService.getLogisticsConfig();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get logistics config controller error:', error);
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
  // ENDPOINTS PARA INTEGRACIÓN CON N8N
  // =====================================================

  // POST /api/logistics/n8n/generate-from-order - Generar remito desde pedido (N8N)
  public async generateRemitoFromOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.body;
      const userId = (req as any).user?.id || 1; // TODO: Obtener del JWT

      if (!orderId) {
        const response: ApiResponse = {
          success: false,
          message: 'orderId es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.generateRemitoFromOrder(orderId, userId);
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Generate remito from order controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/logistics/n8n/update-status - Actualizar estado desde N8N
  public async updateRemitoStatusFromN8N(req: Request, res: Response): Promise<void> {
    try {
      const { remitoId, status, trackingData } = req.body;

      if (!remitoId || !status) {
        const response: ApiResponse = {
          success: false,
          message: 'remitoId y status son requeridos',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.updateRemitoStatusFromN8N(remitoId, status, trackingData);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Update remito status from N8N controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/n8n/sync-data - Obtener datos para sincronización N8N
  public async getRemitosForN8NSync(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query;

      const result = await this.logisticsService.getRemitosForN8NSync(filters);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get remitos for N8N sync controller error:', error);
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
  // ENDPOINTS ESPECIALES PARA OPERACIONES LOGÍSTICAS
  // =====================================================

  // PUT /api/logistics/remitos/:id/prepare - Marcar remito como preparado
  public async prepareRemito(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const userId = (req as any).user?.id || 1;
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.updateRemito(id, { 
        status: 'preparando',
        preparation_notes: 'Remito preparado'
      }, userId);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Prepare remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/logistics/remitos/:id/dispatch - Marcar remito como despachado
  public async dispatchRemito(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { trackingNumber, transportCompany } = req.body;
      const userId = (req as any).user?.id || 1;
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.updateRemito(id, { 
        status: 'en_transito',
        dispatch_date: new Date().toISOString(),
        tracking_number: trackingNumber,
        transport_company: transportCompany
      }, userId);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Dispatch remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/logistics/remitos/:id/deliver - Marcar remito como entregado
  public async deliverRemito(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { signatureData, deliveryPhoto, deliveryNotes } = req.body;
      const userId = (req as any).user?.id || 1;
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.logisticsService.updateRemito(id, { 
        status: 'entregado',
        delivery_date: new Date().toISOString(),
        signature_data: signatureData,
        delivery_photo: deliveryPhoto,
        delivery_notes: deliveryNotes,
        delivered_by: userId
      }, userId);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Deliver remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/logistics/remitos/:id/tracking - Obtener información de seguimiento
  public async getRemitoTracking(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de remito inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Obtener remito con trazabilidad
      const remitoResult = await this.logisticsService.getRemitoById(id);
      if (!remitoResult.success) {
        res.status(404).json(remitoResult);
        return;
      }

      const trazabilidadResult = await this.logisticsService.getTrazabilidadByRemito(id);
      
      const trackingInfo = {
        remito: remitoResult.data,
        tracking_history: trazabilidadResult.data,
        current_status: remitoResult.data?.status,
        estimated_delivery: this.calculateEstimatedDelivery(remitoResult.data?.generation_date),
        last_update: trazabilidadResult.data?.[trazabilidadResult.data.length - 1]?.stage_start
      };

      const response: ApiResponse = {
        success: true,
        message: 'Información de seguimiento obtenida exitosamente',
        data: trackingInfo,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get remito tracking controller error:', error);
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
  // MÉTODOS AUXILIARES PRIVADOS
  // =====================================================

  private calculateEstimatedDelivery(generationDate?: string): string {
    if (!generationDate) return 'No disponible';
    
    const generation = new Date(generationDate);
    const estimated = new Date(generation.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 días
    
    return estimated.toISOString();
  }
}
