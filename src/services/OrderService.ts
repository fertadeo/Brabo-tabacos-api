import { OrderRepository } from '../repositories/OrderRepository';
import { WooCommerceService } from './WooCommerceService';
import { ProductService } from './ProductService';
import { executeQuery } from '../config/database';
import { 
  Order, 
  OrderWithDetails, 
  CreateOrderData, 
  UpdateOrderData,
  OrderFilters,
  OrderStats,
  OrderItem,
  UpdateOrderItemData
} from '../entities/Order';
import { ApiResponse } from '../types';

export class OrderService {
  private orderRepository: OrderRepository;
  private wooCommerceService: WooCommerceService;
  private productService: ProductService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.wooCommerceService = new WooCommerceService();
    this.productService = new ProductService();
  }

  // =====================================================
  // GESTIÓN DE PEDIDOS
  // =====================================================

  async createOrder(data: CreateOrderData, userId: number | null): Promise<ApiResponse> {
    try {
      // Validar que el cliente existe
      await this.validateClient(data.client_id);

      // Validar productos y stock
      await this.validateProductsAvailability(data.items);

      // Crear pedido
      const order = await this.orderRepository.createOrder(data, userId);

      // Si el pedido está en estado aprobado y tiene la configuración activa, reservar stock
      const config = await this.orderRepository.getOrdersConfig();
      if (config.auto_reserve_stock_on_approval && 
          (data.status === 'aprobado' || data.status === 'listo_despacho')) {
        await this.orderRepository.reserveOrderStock(order.id);
      }

      // Enviar notificaciones
      await this.sendOrderNotifications(order, 'created');

      // ⭐ NUEVO: Sincronizar con WooCommerce si está configurado y no viene de WooCommerce
      // Verificar si sync_to_woocommerce está en los datos (flag para evitar bucles)
      const syncToWooCommerce = (data as any).sync_to_woocommerce !== false; // Por defecto true si no se especifica
      // Solo sincronizar si:
      // 1. sync_to_woocommerce es true (o no está definido)
      // 2. El pedido NO viene de WooCommerce (canal_venta !== 'woocommerce')
      // 3. WooCommerce está configurado
      if (syncToWooCommerce && 
          data.canal_venta !== 'woocommerce' && 
          !data.woocommerce_order_id && // No sincronizar si ya tiene woocommerce_order_id
          this.wooCommerceService.isConfigured()) {
        try {
          await this.syncOrderToWooCommerce(order.id, 'create');
        } catch (syncError) {
          console.error('[OrderService] Error sincronizando pedido a WooCommerce:', syncError);
          // No fallar la creación del pedido si falla la sincronización
        }
      }

      return {
        success: true,
        message: 'Pedido creado exitosamente',
        data: order,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error creating order:', error);
      return {
        success: false,
        message: 'Error al crear pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getOrderById(id: number): Promise<ApiResponse> {
    try {
      const order = await this.orderRepository.getOrderById(id);

      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Pedido obtenido exitosamente',
        data: order,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting order:', error);
      return {
        success: false,
        message: 'Error al obtener pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getOrderByNumber(orderNumber: string): Promise<ApiResponse> {
    try {
      const order = await this.orderRepository.getOrderByNumber(orderNumber);

      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Pedido obtenido exitosamente',
        data: order,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting order by number:', error);
      return {
        success: false,
        message: 'Error al obtener pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getOrderByWooCommerceId(woocommerceOrderId: number): Promise<ApiResponse> {
    try {
      const order = await this.orderRepository.getOrderByWooCommerceId(woocommerceOrderId);

      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Pedido obtenido exitosamente',
        data: order,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting order by WooCommerce ID:', error);
      return {
        success: false,
        message: 'Error al obtener pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getAllOrders(filters: OrderFilters = {}): Promise<ApiResponse> {
    try {
      const result = await this.orderRepository.getAllOrders(filters);

      return {
        success: true,
        message: 'Pedidos obtenidos exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting orders:', error);
      return {
        success: false,
        message: 'Error al obtener pedidos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateOrder(id: number, data: UpdateOrderData, userId: number | null): Promise<ApiResponse> {
    try {
      // Validar que el pedido existe
      const existingOrder = await this.orderRepository.getOrderById(id);
      if (!existingOrder) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Validar transiciones de estado
      if (data.status) {
        await this.validateStatusTransition(existingOrder.status, data.status);
      }

      // Si cambia a estado "listo_despacho" o "aprobado", reservar stock automáticamente
      const config = await this.orderRepository.getOrdersConfig();
      if (config.auto_reserve_stock_on_approval && 
          data.status && 
          ['aprobado', 'listo_despacho'].includes(data.status) &&
          !existingOrder.stock_reserved) {
        await this.orderRepository.reserveOrderStock(id);
      }

      // Actualizar pedido
      const updatedOrder = await this.orderRepository.updateOrder(id, data, userId);

      // Enviar notificaciones si cambió el estado
      if (data.status && data.status !== existingOrder.status) {
        await this.sendOrderNotifications(updatedOrder, 'status_changed');
      }

      // ⭐ NUEVO: Sincronizar con WooCommerce si está configurado y tiene woocommerce_order_id
      // Verificar si sync_to_woocommerce está en los datos (flag para evitar bucles)
      const syncToWooCommerce = (data as any).sync_to_woocommerce !== false; // Por defecto true si no se especifica
      if (syncToWooCommerce && 
          updatedOrder.woocommerce_order_id && 
          this.wooCommerceService.isConfigured()) {
        try {
          await this.syncOrderToWooCommerce(updatedOrder.id, 'update');
        } catch (syncError) {
          console.error('[OrderService] Error sincronizando pedido a WooCommerce:', syncError);
          // No fallar la actualización del pedido si falla la sincronización
        }
      }

      return {
        success: true,
        message: 'Pedido actualizado exitosamente',
        data: updatedOrder,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error updating order:', error);
      return {
        success: false,
        message: 'Error al actualizar pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteOrder(id: number): Promise<ApiResponse> {
    try {
      const order = await this.orderRepository.getOrderById(id);
      
      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Validar que se puede eliminar (solo si está en estado 'pendiente_preparacion')
      if (order.status !== 'pendiente_preparacion') {
        return {
          success: false,
          message: 'Solo se pueden eliminar pedidos en estado "pendiente_preparacion"',
          timestamp: new Date().toISOString()
        };
      }

      // ⭐ NUEVO: Sincronizar eliminación con WooCommerce si tiene woocommerce_order_id
      if (order.woocommerce_order_id && this.wooCommerceService.isConfigured()) {
        try {
          await this.wooCommerceService.deleteOrder(order.woocommerce_order_id, false); // Soft delete
          console.log(`[OrderService] Pedido ${order.woocommerce_order_id} eliminado en WooCommerce`);
        } catch (syncError) {
          console.error('[OrderService] Error eliminando pedido en WooCommerce:', syncError);
          // Continuar con la eliminación local aunque falle en WooCommerce
        }
      }

      await this.orderRepository.deleteOrder(id);

      return {
        success: true,
        message: 'Pedido eliminado exitosamente',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error deleting order:', error);
      return {
        success: false,
        message: 'Error al eliminar pedido',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  async getOrderStats(): Promise<ApiResponse> {
    try {
      const stats = await this.orderRepository.getOrderStats();

      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting order stats:', error);
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS PARA INTEGRACIÓN CON REMITOS
  // =====================================================

  async getOrdersReadyForRemito(): Promise<ApiResponse> {
    try {
      const orders = await this.orderRepository.getOrdersReadyForRemito();

      return {
        success: true,
        message: 'Pedidos listos para remito obtenidos exitosamente',
        data: orders,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting orders ready for remito:', error);
      return {
        success: false,
        message: 'Error al obtener pedidos listos para remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async reserveStock(orderId: number): Promise<ApiResponse> {
    try {
      const order = await this.orderRepository.getOrderById(orderId);
      
      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      if (order.stock_reserved) {
        return {
          success: false,
          message: 'El stock ya está reservado para este pedido',
          timestamp: new Date().toISOString()
        };
      }

      // Validar disponibilidad de stock
      await this.validateProductsAvailability(order.items || []);

      // Reservar stock
      await this.orderRepository.reserveOrderStock(orderId);

      return {
        success: true,
        message: 'Stock reservado exitosamente',
        data: { orderId },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error reserving stock:', error);
      return {
        success: false,
        message: 'Error al reservar stock',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateRemitoStatus(orderId: number, remitoStatus: string): Promise<ApiResponse> {
    try {
      await this.orderRepository.updateOrderRemitoStatus(orderId, remitoStatus);

      return {
        success: true,
        message: 'Estado de remito actualizado exitosamente',
        data: { orderId, remitoStatus },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error updating remito status:', error);
      return {
        success: false,
        message: 'Error al actualizar estado de remito',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // CONFIGURACIÓN
  // =====================================================

  async getOrdersConfig(): Promise<ApiResponse> {
    try {
      const config = await this.orderRepository.getOrdersConfig();

      return {
        success: true,
        message: 'Configuración obtenida exitosamente',
        data: config,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting orders config:', error);
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

  private async validateClient(clientId: number): Promise<void> {
    // TODO: Implementar validación del cliente
    // Verificar que existe y está activo
  }

  private async validateProductsAvailability(items: any[]): Promise<void> {
    // TODO: Implementar validación de disponibilidad de productos
    // Verificar que existen y hay stock suficiente
  }

  private async validateStatusTransition(currentStatus: string, newStatus: string): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      'pendiente_preparacion': ['listo_despacho', 'aprobado', 'en_proceso', 'cancelado'],
      'aprobado': ['listo_despacho', 'en_proceso', 'cancelado'],
      'en_proceso': ['listo_despacho', 'completado', 'cancelado'],
      'listo_despacho': ['completado', 'cancelado'],
      'completado': [],
      'cancelado': []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Transición de estado inválida: ${currentStatus} → ${newStatus}`);
    }
  }

  // =====================================================
  // MÉTODOS DE NOTIFICACIÓN PRIVADOS
  // =====================================================

  private async sendOrderNotifications(order: Order, event: string): Promise<void> {
    // TODO: Implementar notificaciones
    // Slack, Email, WhatsApp según configuración
    console.log(`Sending order notification: ${event} for order ${order.order_number}`);
  }

  // =====================================================
  // MÉTODOS DE SINCRONIZACIÓN CON WOOCOMMERCE
  // =====================================================

  /**
   * Sincroniza un pedido del ERP a WooCommerce
   * @param orderId ID del pedido en el ERP
   * @param action Acción a realizar: 'create', 'update', 'delete'
   */
  async syncOrderToWooCommerce(orderId: number, action: 'create' | 'update' | 'delete'): Promise<ApiResponse> {
    try {
      if (!this.wooCommerceService.isConfigured()) {
        return {
          success: false,
          message: 'WooCommerce no está configurado',
          timestamp: new Date().toISOString()
        };
      }

      const order = await this.orderRepository.getOrderById(orderId);
      if (!order) {
        return {
          success: false,
          message: 'Pedido no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Obtener información del cliente
      const [client] = await executeQuery('SELECT * FROM clients WHERE id = ?', [order.client_id]);
      if (!client) {
        return {
          success: false,
          message: 'Cliente no encontrado',
          timestamp: new Date().toISOString()
        };
      }

      // Obtener items del pedido con información de productos
      const items = await this.orderRepository.getOrderItems(orderId);
      
      // Preparar line_items para WooCommerce
      const lineItems = [];
      for (const item of items) {
        const product = await this.productService.getProductById(item.product_id);
        if (!product) {
          console.warn(`[OrderService] Producto ${item.product_id} no encontrado, omitiendo del pedido`);
          continue;
        }

        // Obtener el woocommerce_id del producto desde la base de datos
        const [productData] = await executeQuery(
          'SELECT woocommerce_id, code FROM products WHERE id = ?',
          [item.product_id]
        );

        let wcProductId: number | null = null;

        // Si tiene woocommerce_id, usarlo directamente
        if (productData && productData.woocommerce_id) {
          wcProductId = productData.woocommerce_id;
        } else if (productData && productData.code) {
          // Si no tiene woocommerce_id, buscar por SKU en WooCommerce
          const wcProduct = await this.wooCommerceService.findProductBySku(productData.code);
          if (wcProduct) {
            wcProductId = wcProduct.id;
            // Opcional: Actualizar el producto en el ERP con el woocommerce_id encontrado
            await executeQuery(
              'UPDATE products SET woocommerce_id = ? WHERE id = ?',
              [wcProductId, item.product_id]
            );
          }
        }

        if (!wcProductId) {
          console.warn(`[OrderService] No se pudo encontrar el producto ${product.code} en WooCommerce, omitiendo del pedido`);
          continue;
        }

        lineItems.push({
          product_id: wcProductId,
          quantity: item.quantity,
          price: item.unit_price
        });
      }

      if (lineItems.length === 0) {
        return {
          success: false,
          message: 'El pedido no tiene productos válidos para sincronizar',
          timestamp: new Date().toISOString()
        };
      }

      // Preparar datos de billing y shipping
      const billing = {
        first_name: client.name.split(' ')[0] || client.name,
        last_name: client.name.split(' ').slice(1).join(' ') || '',
        email: client.email || '',
        phone: client.phone || '',
        address_1: order.delivery_address || client.address || '',
        address_2: '',
        city: order.delivery_city || client.city || '',
        state: '',
        postcode: '',
        country: client.country || 'AR',
        company: ''
      };

      const shipping = {
        first_name: order.delivery_contact?.split(' ')[0] || billing.first_name,
        last_name: order.delivery_contact?.split(' ').slice(1).join(' ') || billing.last_name,
        address_1: order.delivery_address || billing.address_1,
        address_2: '',
        city: order.delivery_city || billing.city,
        state: '',
        postcode: '',
        country: billing.country,
        company: '',
        phone: order.delivery_phone || billing.phone
      };

      if (action === 'create') {
        // Buscar o crear cliente en WooCommerce
        let wcCustomerId: number | undefined;
        if (client.email) {
          const wcCustomer = await this.wooCommerceService.findCustomerByEmail(client.email);
          if (wcCustomer) {
            wcCustomerId = wcCustomer.id;
          } else {
            // Crear cliente en WooCommerce
            const newWcCustomer = await this.wooCommerceService.createCustomer({
              email: client.email,
              first_name: billing.first_name,
              last_name: billing.last_name,
              phone: billing.phone,
              billing: billing
            });
            wcCustomerId = newWcCustomer.id;
          }
        }

        // Crear pedido en WooCommerce
        const wcOrder = await this.wooCommerceService.createOrder({
          customer_id: wcCustomerId,
          billing: billing,
          shipping: shipping,
          line_items: lineItems,
          status: order.status,
          currency: order.currency || 'ARS',
          payment_method: order.payment_method,
          payment_method_title: order.payment_method_title,
          customer_note: order.notes || undefined,
          meta_data: [
            { key: '_erp_order_id', value: order.id.toString() },
            { key: '_erp_order_number', value: order.order_number }
          ]
        });

        // Actualizar el pedido en el ERP con el woocommerce_order_id
        // Usar executeQuery directamente para evitar bucles infinitos (no sincronizar de vuelta)
        await executeQuery(
          'UPDATE orders SET woocommerce_order_id = ? WHERE id = ?',
          [wcOrder.id, orderId]
        );

        return {
          success: true,
          message: 'Pedido sincronizado a WooCommerce exitosamente',
          data: {
            woocommerce_order_id: wcOrder.id,
            woocommerce_order_number: wcOrder.number
          },
          timestamp: new Date().toISOString()
        };
      }

      if (action === 'update') {
        if (!order.woocommerce_order_id) {
          return {
            success: false,
            message: 'El pedido no tiene woocommerce_order_id. No se puede actualizar.',
            timestamp: new Date().toISOString()
          };
        }

        // Actualizar pedido en WooCommerce
        // Solo actualizar campos que hayan cambiado para evitar conflictos
        const updateData: any = {
          status: order.status,
          customer_note: order.notes || undefined,
          meta_data: [
            { key: '_erp_order_id', value: order.id.toString() },
            { key: '_erp_order_number', value: order.order_number },
            { key: '_erp_last_sync', value: new Date().toISOString() }
          ]
        };

        // Solo actualizar billing/shipping si han cambiado
        if (order.delivery_address || order.delivery_city) {
          updateData.billing = billing;
          updateData.shipping = shipping;
        }

        // Solo actualizar line_items si han cambiado (comparar con los items actuales)
        // Por ahora, siempre actualizamos los line_items
        updateData.line_items = lineItems;

        const wcOrder = await this.wooCommerceService.updateOrder(order.woocommerce_order_id, updateData);

        return {
          success: true,
          message: 'Pedido actualizado en WooCommerce exitosamente',
          data: {
            woocommerce_order_id: wcOrder.id,
            woocommerce_order_number: wcOrder.number
          },
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: false,
        message: 'Acción no soportada',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[OrderService] Error sincronizando pedido a WooCommerce:', error);
      return {
        success: false,
        message: 'Error al sincronizar pedido con WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Sincroniza manualmente un pedido a WooCommerce (endpoint público)
   */
  async syncOrderToWooCommerceManual(orderId: number): Promise<ApiResponse> {
    const order = await this.orderRepository.getOrderById(orderId);
    if (!order) {
      return {
        success: false,
        message: 'Pedido no encontrado',
        timestamp: new Date().toISOString()
      };
    }

    // Determinar la acción según si tiene woocommerce_order_id
    const action = order.woocommerce_order_id ? 'update' : 'create';
    return await this.syncOrderToWooCommerce(orderId, action);
  }
}

