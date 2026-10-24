import { RepairOrderRepository } from '../repositories/RepairOrderRepository';
import { ProductService } from './ProductService';
import {
  CreateRepairOrderData,
  UpdateRepairOrderData,
  CreateRepairOrderItemData,
  UpdateRepairOrderItemData,
  RepairOrderFilters,
  RepairOrderStats,
  RepairOrderStatus
} from '../entities/RepairOrder';
import { ApiResponse } from '../types';
import { executeQuery } from '../config/database';

const DEFAULT_DAYS_CLAIM = 30;
const AVISO_RETIRO = 'Pasados los {X} días de finalizado el trabajo, si el cliente no pasa a retirar el equipo reparado no tiene derecho a reclamo';

export class RepairOrderService {
  private repo: RepairOrderRepository;
  private productService: ProductService;

  constructor() {
    this.repo = new RepairOrderRepository();
    this.productService = new ProductService();
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private parseMoney(value: unknown): number {
    if (typeof value === 'number') return this.roundMoney(value);
    const n = parseFloat(String(value ?? '0'));
    if (Number.isNaN(n)) return 0;
    return this.roundMoney(n);
  }

  async create(data: CreateRepairOrderData, userId: number | null): Promise<ApiResponse> {
    try {
      const clients = await executeQuery('SELECT id FROM clients WHERE id = ?', [data.client_id]) as any[];
      if (!clients || clients.length === 0) {
        return { success: false, message: 'Cliente no encontrado', timestamp: new Date().toISOString() };
      }
      if (!data.reception_date) {
        return { success: false, message: 'La fecha de recepción es obligatoria', timestamp: new Date().toISOString() };
      }
      const order = await this.repo.create(data, userId);
      return { success: true, message: 'Orden de reparación creada', data: order, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al crear orden', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async getById(id: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      return { success: true, message: 'Orden obtenida', data: order, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al obtener orden', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async getAll(filters: RepairOrderFilters): Promise<ApiResponse> {
    try {
      const result = await this.repo.getAll(filters);
      return { success: true, message: 'Listado de órdenes', data: result, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al listar órdenes', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async update(id: number, data: UpdateRepairOrderData): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status === 'entregado' || order.status === 'cancelado') {
        return { success: false, message: 'No se puede editar una orden entregada o cancelada', timestamp: new Date().toISOString() };
      }
      const updated = await this.repo.update(id, data);
      return { success: true, message: 'Orden actualizada', data: updated, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al actualizar orden', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async getItems(repairOrderId: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      return { success: true, message: 'Ítems obtenidos', data: order.items || [], timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al obtener ítems', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async addItem(repairOrderId: number, item: CreateRepairOrderItemData): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status === 'entregado' || order.status === 'cancelado') {
        return { success: false, message: 'No se pueden agregar ítems a una orden entregada o cancelada', timestamp: new Date().toISOString() };
      }
      const product = await this.productService.getProductById(item.product_id);
      if (!product) return { success: false, message: 'Producto no encontrado', timestamp: new Date().toISOString() };
      if (order.status === 'aceptado' || order.status === 'en_proceso_reparacion' || order.status === 'listo_entrega') {
        if (product.stock < item.quantity) {
          return { success: false, message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`, timestamp: new Date().toISOString() };
        }
      }
      const created = await this.repo.addItem(repairOrderId, item);
      return { success: true, message: 'Ítem agregado', data: created, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al agregar ítem', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async updateItem(repairOrderId: number, itemId: number, data: UpdateRepairOrderItemData): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      await this.repo.updateItem(repairOrderId, itemId, data);
      const updated = await this.repo.getById(repairOrderId);
      return { success: true, message: 'Ítem actualizado', data: updated?.items || [], timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Error al actualizar ítem', timestamp: new Date().toISOString() };
    }
  }

  async deleteItem(repairOrderId: number, itemId: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status === 'entregado') {
        return { success: false, message: 'No se pueden eliminar ítems de una orden entregada', timestamp: new Date().toISOString() };
      }
      await this.repo.deleteItem(repairOrderId, itemId);
      const updated = await this.repo.getById(repairOrderId);
      return { success: true, message: 'Ítem eliminado', data: updated?.items || [], timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Error al eliminar ítem', timestamp: new Date().toISOString() };
    }
  }

  async sendBudget(id: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status !== 'consulta_recibida') {
        return { success: false, message: 'Solo se puede enviar presupuesto desde estado Consulta recibida', timestamp: new Date().toISOString() };
      }
      await this.repo.sendBudget(id);
      const updated = await this.repo.getById(id);
      return { success: true, message: 'Presupuesto enviado', data: updated, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al enviar presupuesto', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async accept(id: number, daysToClaim?: number | null): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status !== 'presupuestado') {
        return { success: false, message: 'Solo se puede aceptar desde estado Presupuestado', timestamp: new Date().toISOString() };
      }
      const items = order.items || [];
      for (const item of items) {
        const product = await this.productService.getProductById(item.product_id);
        if (!product) return { success: false, message: `Producto ID ${item.product_id} no encontrado`, timestamp: new Date().toISOString() };
        if (product.stock < item.quantity) {
          return { success: false, message: `Stock insuficiente para ${product.name} (${product.code}). Disponible: ${product.stock}, solicitado: ${item.quantity}`, timestamp: new Date().toISOString() };
        }
      }
      await this.repo.accept(id, daysToClaim ?? null);
      const updated = await this.repo.getById(id);
      return { success: true, message: 'Presupuesto aceptado. Stock descontado.', data: updated, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al aceptar presupuesto', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async cancel(id: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      if (order.status === 'entregado') {
        return { success: false, message: 'No se puede cancelar una orden ya entregada', timestamp: new Date().toISOString() };
      }
      await this.repo.cancel(id);
      const updated = await this.repo.getById(id);
      return { success: true, message: 'Orden cancelada. Stock reincorporado si correspondía.', data: updated, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al cancelar', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async updateStatus(id: number, status: RepairOrderStatus): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      await this.repo.updateStatus(id, status);
      const updated = await this.repo.getById(id);
      return { success: true, message: 'Estado actualizado', data: updated, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Error al actualizar estado', timestamp: new Date().toISOString() };
    }
  }

  async getAcceptanceDocument(id: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(id);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      const days = order.days_to_claim ?? DEFAULT_DAYS_CLAIM;
      const aviso = AVISO_RETIRO.replace('{X}', String(days));
      const payload = {
        repair_number: order.repair_number,
        work_description: order.work_description || '',
        equipment_description: order.equipment_description,
        customer_declared_fault: order.customer_declared_fault ?? null,
        reception_date: order.reception_date,
        delivery_date_estimated: order.delivery_date_estimated || null,
        total_amount: order.total_amount,
        days_to_claim: days,
        aviso_retiro: aviso,
        client_name: order.client_name,
        client_code: order.client_code ?? null,
        client_email: order.client_email ?? null,
        client_phone: order.client_phone ?? null,
        client_address: order.client_address ?? null,
        client_city: order.client_city ?? null,
        client_cuil_cuit: order.client_cuil_cuit ?? null,
        items: order.items || []
      };
      return { success: true, message: 'Documento de aceptación', data: payload, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al generar documento', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async getPayments(repairOrderId: number): Promise<ApiResponse> {
    try {
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };
      const payments = await this.repo.getPayments(repairOrderId);
      return { success: true, message: 'Pagos obtenidos', data: payments, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al obtener pagos', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async addPayment(
    repairOrderId: number,
    amount: number,
    method: string,
    paymentDate: string,
    userId: number | null,
    movementType: 'cobro' | 'devolucion' = 'cobro',
    notes?: string | null
  ): Promise<ApiResponse> {
    try {
      if (amount <= 0) return { success: false, message: 'El monto debe ser mayor a 0', timestamp: new Date().toISOString() };
      const validMethods = ['efectivo', 'tarjeta', 'transferencia'];
      if (!validMethods.includes(method)) {
        return { success: false, message: 'Método de pago inválido', timestamp: new Date().toISOString() };
      }
      const order = await this.repo.getById(repairOrderId);
      if (!order) return { success: false, message: 'Orden no encontrada', timestamp: new Date().toISOString() };

      const status = order.status;
      const total = this.parseMoney(order.total_amount);
      const paid = this.parseMoney(order.amount_paid);

      if (movementType === 'cobro') {
        if (status === 'entregado') {
          return { success: false, message: 'No se pueden registrar cobros en una orden entregada', timestamp: new Date().toISOString() };
        }
        if (status === 'cancelado') {
          return { success: false, message: 'No se pueden registrar cobros en una orden cancelada', timestamp: new Date().toISOString() };
        }
        const allowed = ['aceptado', 'en_proceso_reparacion', 'listo_entrega'];
        if (!allowed.includes(status)) {
          return { success: false, message: 'Solo se pueden registrar cobros en estados aceptado, en_proceso_reparacion o listo_entrega', timestamp: new Date().toISOString() };
        }
        const newPaid = this.roundMoney(paid + amount);
        if (newPaid - total > 0.0001) {
          return { success: false, message: 'El cobro excede el total de la orden', timestamp: new Date().toISOString() };
        }
      } else {
        // devolución / egreso (reduce el neto cobrado)
        if (status === 'entregado') {
          return { success: false, message: 'No se pueden registrar devoluciones en una orden entregada', timestamp: new Date().toISOString() };
        }
        if (!(status === 'cancelado' || ['aceptado', 'en_proceso_reparacion', 'listo_entrega'].includes(status))) {
          return { success: false, message: 'Devolución no permitida en el estado actual de la orden', timestamp: new Date().toISOString() };
        }
        const newPaid = this.roundMoney(paid - amount);
        if (newPaid < -0.0001) {
          return { success: false, message: 'La devolución excede el monto neto cobrado', timestamp: new Date().toISOString() };
        }
      }

      const { payment, order: updated } = await this.repo.addPayment(
        repairOrderId,
        this.roundMoney(amount),
        method,
        paymentDate,
        userId,
        movementType,
        notes
      );
      return {
        success: true,
        message: movementType === 'devolucion' ? 'Devolución registrada' : 'Pago registrado',
        data: { payment, repair_order: updated },
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return { success: false, message: 'Error al registrar pago', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }

  async getStats(): Promise<ApiResponse> {
    try {
      const stats: RepairOrderStats = await this.repo.getStats();
      return { success: true, message: 'Estadísticas obtenidas', data: stats, timestamp: new Date().toISOString() };
    } catch (e) {
      return { success: false, message: 'Error al obtener estadísticas', error: e instanceof Error ? e.message : 'Unknown error', timestamp: new Date().toISOString() };
    }
  }
}
