import { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { CreateOrderData, UpdateOrderData, OrderFilters } from '../entities/Order';
import { ApiResponse } from '../types';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  // =====================================================
  // GESTIÓN DE PEDIDOS
  // =====================================================

  // POST /api/orders - Crear nuevo pedido
  public async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateOrderData = req.body;
      const userId = (req as any).user?.id || 1; // TODO: Obtener del JWT

      // Si no se especifica canal_venta, es un pedido local
      if (!data.canal_venta) {
        data.canal_venta = 'local';
      }

      // Si no se especifica json, guardar todos los datos del pedido como JSON
      // Esto permite tener un registro completo de cómo se creó el pedido localmente
      if (!data.json) {
        data.json = {
          // Datos principales del pedido
          client_id: data.client_id,
          order_number: data.order_number,
          status: data.status || 'pendiente_preparacion',
          delivery_date: data.delivery_date,
          delivery_address: data.delivery_address,
          delivery_city: data.delivery_city,
          delivery_contact: data.delivery_contact,
          delivery_phone: data.delivery_phone,
          transport_company: data.transport_company,
          transport_cost: data.transport_cost,
          notes: data.notes,
          // Items del pedido
          items: data.items,
          // Metadatos de creación
          created_by: userId,
          created_at: new Date().toISOString(),
          // Información del usuario que creó el pedido (si está disponible)
          user_info: (req as any).user ? {
            id: (req as any).user.id,
            email: (req as any).user.email,
            name: (req as any).user.name
          } : null
        };
      }

      const result = await this.orderService.createOrder(data, userId);
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Create order controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/orders/:id - Obtener pedido por ID
  public async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.getOrderById(id);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get order by ID controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/orders/number/:number - Obtener pedido por número
  public async getOrderByNumber(req: Request, res: Response): Promise<void> {
    try {
      const orderNumber = req.params.number;
      
      if (!orderNumber) {
        const response: ApiResponse = {
          success: false,
          message: 'Número de pedido requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.getOrderByNumber(orderNumber);
      
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Get order by number controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/orders - Obtener todos los pedidos con filtros
  public async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const filters: OrderFilters = {
        status: req.query.status as string,
        client_id: req.query.client_id ? parseInt(req.query.client_id as string, 10) : undefined,
        remito_status: req.query.remito_status as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        stock_reserved: req.query.stock_reserved === 'true' ? true : req.query.stock_reserved === 'false' ? false : undefined,
        has_remito: req.query.has_remito === 'true' ? true : req.query.has_remito === 'false' ? false : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      };

      const result = await this.orderService.getAllOrders(filters);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get all orders controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/orders/:id - Actualizar pedido
  public async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const data: UpdateOrderData = req.body;
      const userId = (req as any).user?.id || 1; // TODO: Obtener del JWT

      const result = await this.orderService.updateOrder(id, data, userId);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Update order controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/orders/:id - Eliminar pedido
  public async deleteOrder(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.deleteOrder(id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Delete order controller error:', error);
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

  // GET /api/orders/stats - Obtener estadísticas del módulo
  public async getOrderStats(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.orderService.getOrderStats();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get order stats controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/orders/config - Obtener configuración del módulo
  public async getOrdersConfig(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.orderService.getOrdersConfig();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get orders config controller error:', error);
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
  // OPERACIONES ESPECIALES
  // =====================================================

  // GET /api/orders/ready-for-remito - Obtener pedidos listos para remito
  public async getOrdersReadyForRemito(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.orderService.getOrdersReadyForRemito();
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Get orders ready for remito controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/orders/:id/reserve-stock - Reservar stock para pedido
  public async reserveStock(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.reserveStock(id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Reserve stock controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/orders/:id/remito-status - Actualizar estado de remito
  public async updateRemitoStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { remitoStatus } = req.body;
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!remitoStatus) {
        const response: ApiResponse = {
          success: false,
          message: 'Estado de remito requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.updateRemitoStatus(id, remitoStatus);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Update remito status controller error:', error);
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

  // POST /api/orders/:id/sync-to-woocommerce - Sincronizar pedido a WooCommerce manualmente
  public async syncOrderToWooCommerce(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        const response: ApiResponse = {
          success: false,
          message: 'ID de pedido inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.orderService.syncOrderToWooCommerceManual(id);
      
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Sync order to WooCommerce controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}

