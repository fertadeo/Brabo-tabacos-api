import { RemitoRepository } from '../repositories/RemitoRepository';
import { 
  Remito, 
  RemitoWithDetails, 
  CreateRemitoData, 
  UpdateRemitoData,
  RemitoFilters,
  RemitoStats,
  RemitoItem,
  CreateRemitoItemData,
  UpdateRemitoItemData,
  TrazabilidadEntry,
  CreateTrazabilidadData,
  TrazabilidadFilters,
  StockMovement,
  DeliveryZone,
  TransportCompany,
  LogisticsConfig
} from '../entities/Remito';
import { ApiResponse } from '../types';

export class LogisticsService {
  private remitoRepository: RemitoRepository;

  constructor() {
    this.remitoRepository = new RemitoRepository();
  }

  // =====================================================
  // GESTIÓN DE REMITOS
  // =====================================================

  async createRemito(data: CreateRemitoData, userId: number): Promise<ApiResponse> {
    try {
      // Validar que el pedido existe y está en estado válido
      await this.validateOrderForRemito(data.order_id);

      // Validar que el cliente existe
      await this.validateClient(data.client_id);

      // Validar productos y stock
      await this.validateProductsStock(data.items);

      // Crear remito
      const remito = await this.remitoRepository.createRemito(data, userId);

      // Crear entrada inicial de trazabilidad
      await this.createInitialTrazabilidad(remito.id, data.items, userId);

      // Enviar notificaciones
      await this.sendRemitoNotifications(remito, 'created');

      return {
        success: true,
        message: 'Remito creado exitosamente',
        data: remito,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error creating remito:', error);
      return {
        success: false,
        message: 'Error al crear remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getRemitoById(id: number): Promise<ApiResponse> {
    try {
      const remito = await this.remitoRepository.getRemitoById(id);

      if (!remito) {
        return {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Remito obtenido exitosamente',
        data: remito,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting remito:', error);
      return {
        success: false,
        message: 'Error al obtener remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getRemitoByNumber(remitoNumber: string): Promise<ApiResponse> {
    try {
      const remito = await this.remitoRepository.getRemitoByNumber(remitoNumber);

      if (!remito) {
        return {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Remito obtenido exitosamente',
        data: remito,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting remito by number:', error);
      return {
        success: false,
        message: 'Error al obtener remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getAllRemitos(filters: RemitoFilters = {}): Promise<ApiResponse> {
    try {
      const result = await this.remitoRepository.getAllRemitos(filters);

      return {
        success: true,
        message: 'Remitos obtenidos exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting remitos:', error);
      return {
        success: false,
        message: 'Error al obtener remitos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateRemito(id: number, data: UpdateRemitoData, userId: number): Promise<ApiResponse> {
    try {
      // Validar que el remito existe
      const existingRemito = await this.remitoRepository.getRemitoById(id);
      if (!existingRemito) {
        return {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Validar transiciones de estado
      if (data.status) {
        await this.validateStatusTransition(existingRemito.status, data.status);
      }

      // Actualizar remito
      const updatedRemito = await this.remitoRepository.updateRemito(id, data, userId);

      // Crear entrada de trazabilidad si cambió el estado
      if (data.status && data.status !== existingRemito.status) {
        await this.createStatusChangeTrazabilidad(id, data.status, userId);
      }

      // Enviar notificaciones si cambió el estado
      if (data.status) {
        await this.sendRemitoNotifications(updatedRemito, 'status_changed');
      }

      return {
        success: true,
        message: 'Remito actualizado exitosamente',
        data: updatedRemito,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error updating remito:', error);
      return {
        success: false,
        message: 'Error al actualizar remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteRemito(id: number): Promise<ApiResponse> {
    try {
      const remito = await this.remitoRepository.getRemitoById(id);
      
      if (!remito) {
        return {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Validar que se puede eliminar (solo si está en estado 'generado')
      if (remito.status !== 'generado') {
        return {
          success: false,
          message: 'Solo se pueden eliminar remitos en estado "generado"',
          timestamp: new Date().toISOString()
        };
      }

      await this.remitoRepository.deleteRemito(id);

      return {
        success: true,
        message: 'Remito eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error deleting remito:', error);
      return {
        success: false,
        message: 'Error al eliminar remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // GESTIÓN DE TRAZABILIDAD
  // =====================================================

  async createTrazabilidadEntry(data: CreateTrazabilidadData): Promise<ApiResponse> {
    try {
      // Validar que el remito existe
      const remito = await this.remitoRepository.getRemitoById(data.remito_id);
      if (!remito) {
        return {
          success: false,
          message: 'Remito no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Validar que el producto está en el remito
      const items = await this.remitoRepository.getRemitoItems(data.remito_id);
      const productInRemito = items.some(item => item.product_id === data.product_id);
      
      if (!productInRemito) {
        return {
          success: false,
          message: 'El producto no está incluido en este remito',
          timestamp: new Date().toISOString()
        };
      }

      // Crear entrada de trazabilidad
      const entry = await this.remitoRepository.createTrazabilidadEntry(data);

      // Enviar notificación si es una etapa importante
      await this.sendTrazabilidadNotifications(entry);

      return {
        success: true,
        message: 'Entrada de trazabilidad creada exitosamente',
        data: entry,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error creating trazabilidad entry:', error);
      return {
        success: false,
        message: 'Error al crear entrada de trazabilidad',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getTrazabilidadByRemito(remitoId: number): Promise<ApiResponse> {
    try {
      const trackingHistory = await this.remitoRepository.getTrazabilidadByRemito(remitoId);

      return {
        success: true,
        message: 'Historial de trazabilidad obtenido exitosamente',
        data: trackingHistory,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting trazabilidad:', error);
      return {
        success: false,
        message: 'Error al obtener historial de trazabilidad',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  async getRemitoStats(): Promise<ApiResponse> {
    try {
      const stats = await this.remitoRepository.getRemitoStats();

      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting remito stats:', error);
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // CONFIGURACIÓN DEL MÓDULO
  // =====================================================

  async getDeliveryZones(): Promise<ApiResponse> {
    try {
      const zones = await this.remitoRepository.getDeliveryZones();

      return {
        success: true,
        message: 'Zonas de entrega obtenidas exitosamente',
        data: zones,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting delivery zones:', error);
      return {
        success: false,
        message: 'Error al obtener zonas de entrega',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getTransportCompanies(): Promise<ApiResponse> {
    try {
      const companies = await this.remitoRepository.getTransportCompanies();

      return {
        success: true,
        message: 'Empresas de transporte obtenidas exitosamente',
        data: companies,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting transport companies:', error);
      return {
        success: false,
        message: 'Error al obtener empresas de transporte',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getLogisticsConfig(): Promise<ApiResponse> {
    try {
      const config = await this.remitoRepository.getLogisticsConfig();

      return {
        success: true,
        message: 'Configuración obtenida exitosamente',
        data: config,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting logistics config:', error);
      return {
        success: false,
        message: 'Error al obtener configuración',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // MÉTODOS DE VALIDACIÓN PRIVADOS
  // =====================================================

  private async validateOrderForRemito(orderId: number): Promise<void> {
    // TODO: Implementar validación del pedido
    // Verificar que existe, está aprobado, no tiene remito previo, etc.
  }

  private async validateClient(clientId: number): Promise<void> {
    // TODO: Implementar validación del cliente
    // Verificar que existe y está activo
  }

  private async validateProductsStock(items: CreateRemitoItemData[]): Promise<void> {
    // TODO: Implementar validación de stock
    // Verificar que hay stock suficiente para cada producto
  }

  // =====================================================
  // MÉTODOS DE VALIDACIÓN ESPECÍFICOS PARA GENERACIÓN AUTOMÁTICA
  // =====================================================

  private async validateOrderForRemitoGeneration(orderId: number): Promise<any> {
    // Validar que el pedido existe y está en estado válido
    // Estados válidos: 'listo_despacho', 'pagado', 'aprobado'
    const validStates = ['listo_despacho', 'pagado', 'aprobado'];
    
    // TODO: Implementar consulta a la base de datos
    // SELECT * FROM orders WHERE id = ? AND status IN (validStates) AND is_active = TRUE
    
    // Por ahora retornamos un objeto mock para la estructura
    return {
      id: orderId,
      order_number: `ORD-${orderId}`,
      client_id: 1,
      status: 'listo_despacho',
      delivery_address: 'Av. Corrientes 1234',
      delivery_city: 'CABA',
      delivery_contact: 'Juan Pérez',
      delivery_phone: '11-1234-5678',
      transport_company: 'OCA',
      transport_cost: 500
    };
  }

  private async getRemitoByOrderId(orderId: number): Promise<any> {
    // Verificar si ya existe un remito para este pedido
    // TODO: Implementar consulta
    // SELECT * FROM remitos WHERE order_id = ? AND is_active = TRUE
    
    return null; // Por ahora retornamos null (no existe)
  }

  private async validateOrderStockReservation(orderId: number): Promise<{isValid: boolean, issues: string[]}> {
    // Validar que todos los productos del pedido tienen stock reservado
    // TODO: Implementar validación de stock reservado
    
    return {
      isValid: true,
      issues: []
    };
  }

  private async getOrderItems(orderId: number): Promise<any[]> {
    // Obtener todos los items del pedido
    // TODO: Implementar consulta
    // SELECT * FROM order_items WHERE order_id = ?
    
    return [
      {
        product_id: 1,
        quantity: 5,
        unit_price: 1500.00,
        batch_number: 'LOT-2024-001',
        notes: 'Producto estándar'
      }
    ];
  }

  private async updateOrderRemitoStatus(orderId: number, status: string): Promise<void> {
    // Actualizar el estado del pedido para indicar que tiene remito
    // TODO: Implementar actualización
    // UPDATE orders SET remito_status = ? WHERE id = ?
    
    console.log(`Updating order ${orderId} remito status to: ${status}`);
  }

  private async validateStatusTransition(currentStatus: string, newStatus: string): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      'generado': ['preparando', 'cancelado'],
      'preparando': ['listo_despacho', 'cancelado'],
      'listo_despacho': ['en_transito', 'cancelado'],
      'en_transito': ['entregado', 'devuelto'],
      'entregado': ['devuelto'], // Solo para devoluciones
      'devuelto': [],
      'cancelado': []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Transición de estado inválida: ${currentStatus} → ${newStatus}`);
    }
  }

  // =====================================================
  // MÉTODOS DE NOTIFICACIÓN PRIVADOS
  // =====================================================

  private async createInitialTrazabilidad(remitoId: number, items: CreateRemitoItemData[], userId: number): Promise<void> {
    for (const item of items) {
      await this.remitoRepository.createTrazabilidadEntry({
        remito_id: remitoId,
        product_id: item.product_id,
        stage: 'preparacion',
        location: 'Depósito Principal',
        responsible_user_id: userId,
        notes: 'Remito generado automáticamente',
        is_automatic: true
      });
    }
  }

  private async createStatusChangeTrazabilidad(remitoId: number, newStatus: string, userId: number): Promise<void> {
    // TODO: Implementar creación de trazabilidad al cambiar estado
  }

  private async sendRemitoNotifications(remito: Remito, event: string): Promise<void> {
    // TODO: Implementar notificaciones
    // Slack, Email, WhatsApp según configuración
    console.log(`Sending remito notification: ${event} for remito ${remito.remito_number}`);
  }

  private async sendTrazabilidadNotifications(entry: TrazabilidadEntry): Promise<void> {
    // TODO: Implementar notificaciones de trazabilidad
    console.log(`Sending trazabilidad notification for stage: ${entry.stage}`);
  }

  // =====================================================
  // MÉTODOS DE INTEGRACIÓN CON N8N
  // =====================================================

  async generateRemitoFromOrder(orderId: number, userId: number): Promise<ApiResponse> {
    try {
      // Validar que el pedido existe y está en estado válido para generar remito
      const order = await this.validateOrderForRemitoGeneration(orderId);
      
      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado o no está en estado válido para generar remito',
          timestamp: new Date().toISOString()
        };
      }

      // Verificar que no existe ya un remito para este pedido
      const existingRemito = await this.getRemitoByOrderId(orderId);
      if (existingRemito) {
        return {
          success: false,
          message: 'Ya existe un remito para este pedido',
          data: { orderId, existingRemitoId: existingRemito.id },
          timestamp: new Date().toISOString()
        };
      }

      // Validar que el pedido tiene stock reservado y está listo para despacho
      const stockValidation = await this.validateOrderStockReservation(orderId);
      if (!stockValidation.isValid) {
        return {
          success: false,
          message: 'El pedido no tiene stock suficiente reservado',
          data: { orderId, stockIssues: stockValidation.issues },
          timestamp: new Date().toISOString()
        };
      }

      // Obtener items del pedido para crear el remito
      const orderItems = await this.getOrderItems(orderId);
      
      // Crear datos del remito automáticamente
      const remitoData: CreateRemitoData = {
        order_id: orderId,
        client_id: order.client_id,
        remito_type: 'entrega_cliente',
        delivery_address: order.delivery_address || order.client_address,
        delivery_city: order.delivery_city || order.client_city,
        delivery_contact: order.delivery_contact || order.client_contact,
        delivery_phone: order.delivery_phone || order.client_phone,
        transport_company: order.transport_company,
        transport_cost: order.transport_cost || 0,
        preparation_notes: `Remito generado automáticamente desde pedido ${order.order_number}`,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          batch_number: item.batch_number,
          notes: item.notes
        }))
      };

      // Crear el remito
      const remito = await this.remitoRepository.createRemito(remitoData, userId);

      // Actualizar el pedido para indicar que tiene remito generado
      await this.updateOrderRemitoStatus(orderId, 'remito_generado');

      // Enviar notificaciones
      await this.sendRemitoNotifications(remito, 'auto_generated');

      return {
        success: true,
        message: 'Remito generado automáticamente desde pedido',
        data: { orderId, remitoId: remito.id, remitoNumber: remito.remito_number },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating remito from order:', error);
      return {
        success: false,
        message: 'Error al generar remito desde pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateRemitoStatusFromN8N(remitoId: number, status: string, trackingData?: any): Promise<ApiResponse> {
    try {
      // TODO: Implementar actualización de estado desde N8N
      // Este método será llamado por workflows de N8N
      
      return {
        success: true,
        message: 'Estado de remito actualizado desde N8N',
        data: { remitoId, status, trackingData },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error updating remito status from N8N:', error);
      return {
        success: false,
        message: 'Error al actualizar estado desde N8N',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getRemitosForN8NSync(filters: any): Promise<ApiResponse> {
    try {
      // TODO: Implementar endpoint específico para sincronización con N8N
      
      return {
        success: true,
        message: 'Datos de remitos para N8N obtenidos exitosamente',
        data: [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting remitos for N8N sync:', error);
      return {
        success: false,
        message: 'Error al obtener datos para N8N',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
