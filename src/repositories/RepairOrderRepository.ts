import Database from '../config/database';
import { executeQuery } from '../config/database';
import {
  RepairOrder,
  RepairOrderWithDetails,
  RepairOrderItem,
  CreateRepairOrderData,
  UpdateRepairOrderData,
  CreateRepairOrderItemData,
  UpdateRepairOrderItemData,
  RepairOrderFilters,
  RepairOrderStats,
  RepairOrderStatus
} from '../entities/RepairOrder';

export class RepairOrderRepository {
  private db: typeof Database;

  constructor() {
    this.db = Database;
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private formatMoneyString(value: number): string {
    return this.roundMoney(value).toFixed(2);
  }

  private toMysqlDateTimeFromIso(iso: string): string {
    // Acepta ISO8601 (con T o espacio) y lo normaliza a 'YYYY-MM-DD HH:MM:SS' para MySQL DATETIME
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private toIsoFromMysqlDateTime(value: any): string | null {
    if (value == null) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    const s = String(value);
    // 'YYYY-MM-DD HH:MM:SS' -> ISO (asumimos hora local del servidor MySQL; suficiente para consistencia UI)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!m) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? s : d.toISOString();
    }
    const [, y, mo, d, h, mi, se] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
    return Number.isNaN(dt.getTime()) ? s : dt.toISOString();
  }

  private mapRepairOrderRow(row: any): any {
    if (!row) return row;
    const labor = Number(row.labor_amount || 0);
    const total = Number(row.total_amount || 0);
    const paid = Number(row.amount_paid || 0);
    const balance = this.roundMoney(total - paid);
    return {
      ...row,
      labor_amount: this.formatMoneyString(labor),
      total_amount: this.formatMoneyString(total),
      amount_paid: this.formatMoneyString(paid),
      balance: this.formatMoneyString(balance)
    };
  }

  private mapRepairOrderItemRow(item: any): any {
    if (!item) return item;
    const qty = parseInt(String(item.quantity ?? 0), 10) || 0;
    const unit = Number(item.unit_price || 0);
    const total = Number(item.total_price || 0);
    return {
      ...item,
      quantity: qty,
      unit_price: this.formatMoneyString(unit),
      total_price: this.formatMoneyString(total)
    };
  }

  private mapPaymentRow(p: any): any {
    if (!p) return p;
    const amount = Number(p.amount || 0);
    return {
      id: p.id,
      amount: this.formatMoneyString(amount),
      method: p.method,
      payment_date: this.toIsoFromMysqlDateTime(p.payment_date),
      related_type: p.related_type ?? 'repair_order',
      related_id: p.related_id,
      created_at: this.toIsoFromMysqlDateTime(p.created_at),
      movement_type: p.movement_type,
      notes: p.notes ?? null
    };
  }

  private toNull(value: any): any {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }

  private async generateRepairNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `REP-${year}${month}`;
    const lastResult = await executeQuery(
      `SELECT repair_number FROM repair_orders WHERE repair_number LIKE ? ORDER BY repair_number DESC LIMIT 1`,
      [`${prefix}-%`]
    ) as any[];
    const last = lastResult[0];
    let sequence = 1;
    if (last?.repair_number) {
      const lastSeq = parseInt(last.repair_number.split('-')[2] || '0', 10);
      sequence = lastSeq + 1;
    }
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  async create(data: CreateRepairOrderData, userId: number | null): Promise<RepairOrder> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const repairNumber = await this.generateRepairNumber();
      const laborAmount = this.roundMoney(Number(data.labor_amount ?? 0));
      const [result] = await connection.execute(
        `INSERT INTO repair_orders (
          repair_number, client_id, equipment_description, customer_declared_fault, diagnosis, work_description,
          reception_date, delivery_date_estimated, labor_amount, total_amount, amount_paid,
          status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'consulta_recibida', ?, ?)`,
        [
          repairNumber,
          data.client_id,
          data.equipment_description,
          this.toNull(data.customer_declared_fault),
          this.toNull(data.diagnosis),
          this.toNull(data.work_description),
          data.reception_date,
          this.toNull(data.delivery_date_estimated),
          laborAmount,
          laborAmount,
          this.toNull(data.notes),
          userId
        ]
      ) as any[];
      const id = (result as any).insertId;
      await connection.commit();
      const order = await this.getById(id);
      if (!order) throw new Error('Error creando la orden de reparación');
      return order;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  async getById(id: number): Promise<RepairOrderWithDetails | null> {
    const rows = await executeQuery(
      `SELECT ro.*, c.name as client_name, c.code as client_code, c.email as client_email,
        c.phone as client_phone, c.address as client_address, c.city as client_city,
        c.cuil_cuit as client_cuil_cuit,
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.username) as created_by_name
       FROM repair_orders ro
       LEFT JOIN clients c ON ro.client_id = c.id
       LEFT JOIN users u ON ro.created_by = u.id
       WHERE ro.id = ?`,
      [id]
    ) as any[];
    if (!rows?.length) return null;
    const order = this.mapRepairOrderRow(rows[0]);
    const rawItems = await this.fetchItemsRaw(id);
    order.items = rawItems.map((i: any) => this.mapRepairOrderItemRow({ ...i, stock_deducted: Boolean(i.stock_deducted) }));

    const linkedBudgets = (await executeQuery(
      `SELECT id, budget_number, status, total_amount
       FROM budgets
       WHERE repair_order_id = ?
       ORDER BY created_at DESC, id DESC`,
      [id]
    )) as any[];
    order.linked_commercial_budgets = (linkedBudgets || []).map((b: any) => ({
      id: b.id,
      budget_number: b.budget_number,
      status: b.status,
      total_amount: Number(b.total_amount)
    }));

    return order;
  }

  private async fetchItemsRaw(repairOrderId: number): Promise<any[]> {
    const items = await executeQuery(
      `SELECT roi.*, p.name as product_name, p.code as product_code
       FROM repair_order_items roi
       LEFT JOIN products p ON roi.product_id = p.id
       WHERE roi.repair_order_id = ?
       ORDER BY roi.id`,
      [repairOrderId]
    ) as any[];
    return items || [];
  }

  async getItems(repairOrderId: number): Promise<RepairOrderItem[]> {
    const items = await this.fetchItemsRaw(repairOrderId);
    return items.map((i: any) => this.mapRepairOrderItemRow({
      ...i,
      stock_deducted: Boolean(i.stock_deducted)
    }));
  }

  async getAll(filters: RepairOrderFilters = {}): Promise<{ repair_orders: RepairOrderWithDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (filters.status) {
      where += ' AND ro.status = ?';
      params.push(filters.status);
    }
    if (filters.client_id) {
      where += ' AND ro.client_id = ?';
      params.push(filters.client_id);
    }
    if (filters.date_from) {
      where += ' AND DATE(ro.reception_date) >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      where += ' AND DATE(ro.reception_date) <= ?';
      params.push(filters.date_to);
    }
    const [countRow] = await executeQuery(
      `SELECT COUNT(*) as total FROM repair_orders ro ${where}`,
      params
    ) as any[];
    const total = countRow?.total ?? 0;
    const list = await executeQuery(
      `SELECT ro.*, c.name as client_name, c.code as client_code, c.email as client_email,
        c.phone as client_phone, c.address as client_address, c.city as client_city,
        c.cuil_cuit as client_cuil_cuit,
        s.facturacion_archived as linked_sale_facturacion_archived,
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.username) as created_by_name
       FROM repair_orders ro
       LEFT JOIN clients c ON ro.client_id = c.id
       LEFT JOIN sales s ON ro.sale_id = s.id
       LEFT JOIN users u ON ro.created_by = u.id
       ${where}
       ORDER BY ro.reception_date DESC, ro.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ) as any[];
    const repair_orders: RepairOrderWithDetails[] = [];
    for (const row of list || []) {
      const mapped = this.mapRepairOrderRow(row);
      mapped.items = await this.getItems(row.id);
      repair_orders.push(mapped);
    }
    return { repair_orders, total, page, limit };
  }

  private async recalcTotalAmount(repairOrderId: number): Promise<void> {
    const [order] = await executeQuery(
      `SELECT labor_amount FROM repair_orders WHERE id = ?`,
      [repairOrderId]
    ) as any[];
    if (!order) return;
    const [sumRow] = await executeQuery(
      `SELECT COALESCE(SUM(total_price), 0) as items_total FROM repair_order_items WHERE repair_order_id = ?`,
      [repairOrderId]
    ) as any[];
    const labor = Number(order.labor_amount || 0);
    const itemsTotal = Number(sumRow?.items_total || 0);
    const total = this.roundMoney(labor + itemsTotal);
    await executeQuery(
      `UPDATE repair_orders SET total_amount = ? WHERE id = ?`,
      [total, repairOrderId]
    );
  }

  private async recalcAmountPaid(connection: any, repairOrderId: number): Promise<number> {
    const [rows] = await connection.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'outflow' THEN amount ELSE 0 END), 0) AS net
       FROM payments
       WHERE related_type = 'repair_order'
         AND related_id = ?
         AND status = 'posted'`,
      [repairOrderId]
    ) as any[];
    const sumRow = Array.isArray(rows) ? rows[0] : rows;
    const net = this.roundMoney(Number(sumRow?.net ?? 0));
    await connection.execute(
      `UPDATE repair_orders SET amount_paid = ? WHERE id = ?`,
      [net, repairOrderId]
    );
    return net;
  }

  async update(id: number, data: UpdateRepairOrderData): Promise<RepairOrderWithDetails | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.equipment_description !== undefined) {
      fields.push('equipment_description = ?');
      values.push(data.equipment_description);
    }
    if (data.customer_declared_fault !== undefined) {
      fields.push('customer_declared_fault = ?');
      values.push(this.toNull(data.customer_declared_fault));
    }
    if (data.diagnosis !== undefined) {
      fields.push('diagnosis = ?');
      values.push(this.toNull(data.diagnosis));
    }
    if (data.work_description !== undefined) {
      fields.push('work_description = ?');
      values.push(this.toNull(data.work_description));
    }
    if (data.reception_date !== undefined) {
      fields.push('reception_date = ?');
      values.push(data.reception_date);
    }
    if (data.delivery_date_estimated !== undefined) {
      fields.push('delivery_date_estimated = ?');
      values.push(this.toNull(data.delivery_date_estimated));
    }
    if (data.labor_amount !== undefined) {
      fields.push('labor_amount = ?');
      values.push(this.roundMoney(Number(data.labor_amount)));
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(this.toNull(data.notes));
    }
    if (fields.length === 0) return this.getById(id);
    values.push(id);
    await executeQuery(
      `UPDATE repair_orders SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    await this.recalcTotalAmount(id);
    return this.getById(id);
  }

  async addItem(repairOrderId: number, item: CreateRepairOrderItemData): Promise<RepairOrderItem> {
    const totalPrice = this.roundMoney(item.quantity * item.unit_price);
    // ResultSetHeader es objeto; destructurar como array lanzaba error y el servicio respondía 400.
    const result = (await executeQuery(
      `INSERT INTO repair_order_items (repair_order_id, product_id, quantity, unit_price, total_price, stock_deducted)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [repairOrderId, item.product_id, item.quantity, item.unit_price, totalPrice]
    )) as { insertId?: number | bigint };
    const id = Number(result.insertId);
    await this.recalcTotalAmount(repairOrderId);
    const items = await this.getItems(repairOrderId);
    const created = items.find(i => Number(i.id) === id);
    if (!created) throw new Error('No se pudo recuperar el ítem recién insertado');
    return created;
  }

  async updateItem(repairOrderId: number, itemId: number, data: UpdateRepairOrderItemData): Promise<void> {
    const items = await this.fetchItemsRaw(repairOrderId);
    const existing = items.find((i: any) => i.id === itemId);
    if (!existing) throw new Error('Ítem no encontrado');
    let quantity = parseInt(String(existing.quantity ?? 0), 10) || 0;
    let unitPrice = Number(existing.unit_price || 0);
    if (data.quantity !== undefined) quantity = data.quantity;
    if (data.unit_price !== undefined) unitPrice = data.unit_price;
    const totalPrice = this.roundMoney(quantity * unitPrice);
    const stockDeducted = Boolean((existing as any).stock_deducted);
    if (stockDeducted && quantity < existing.quantity) {
      const returnQty = existing.quantity - quantity;
      await executeQuery(
        `UPDATE products SET stock = stock + ? WHERE id = ?`,
        [returnQty, existing.product_id]
      );
    }
    await executeQuery(
      `UPDATE repair_order_items SET quantity = ?, unit_price = ?, total_price = ? WHERE id = ? AND repair_order_id = ?`,
      [quantity, unitPrice, totalPrice, itemId, repairOrderId]
    );
    await this.recalcTotalAmount(repairOrderId);
  }

  async deleteItem(repairOrderId: number, itemId: number): Promise<void> {
    const items = await this.fetchItemsRaw(repairOrderId);
    const item = items.find((i: any) => i.id === itemId);
    if (!item) throw new Error('Ítem no encontrado');
    const stockDeducted = Boolean((item as any).stock_deducted);
    if (stockDeducted) {
      await executeQuery(
        `UPDATE products SET stock = stock + ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }
    await executeQuery(
      `DELETE FROM repair_order_items WHERE id = ? AND repair_order_id = ?`,
      [itemId, repairOrderId]
    );
    await this.recalcTotalAmount(repairOrderId);
  }

  async sendBudget(id: number): Promise<void> {
    await executeQuery(
      `UPDATE repair_orders SET status = 'presupuestado', budget_sent_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  async accept(id: number, daysToClaim?: number | null): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const items = await executeQuery(
        `SELECT * FROM repair_order_items WHERE repair_order_id = ? ORDER BY id`,
        [id],
        connection
      ) as any[];
      for (const item of items || []) {
        if (!item.stock_deducted) {
          await connection.execute(
            `UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?`,
            [item.quantity, item.product_id]
          );
          await connection.execute(
            `UPDATE repair_order_items SET stock_deducted = 1 WHERE id = ?`,
            [item.id]
          );
        }
      }
      await connection.execute(
        `UPDATE repair_orders SET status = 'aceptado', accepted_at = NOW(), days_to_claim = ? WHERE id = ?`,
        [this.toNull(daysToClaim), id]
      );
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  async cancel(id: number): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const items = await executeQuery(
        `SELECT * FROM repair_order_items WHERE repair_order_id = ? ORDER BY id`,
        [id],
        connection
      ) as any[];
      for (const item of items || []) {
        if (item.stock_deducted) {
          await connection.execute(
            `UPDATE products SET stock = stock + ? WHERE id = ?`,
            [item.quantity, item.product_id]
          );
          await connection.execute(
            `UPDATE repair_order_items SET stock_deducted = 0 WHERE id = ?`,
            [item.id]
          );
        }
      }
      await connection.execute(
        `UPDATE repair_orders SET status = 'cancelado' WHERE id = ?`,
        [id]
      );
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  private static ALLOWED_TRANSITIONS: Record<RepairOrderStatus, RepairOrderStatus[]> = {
    consulta_recibida: ['presupuestado', 'cancelado'],
    presupuestado: ['aceptado', 'cancelado'],
    aceptado: ['en_proceso_reparacion', 'cancelado'],
    en_proceso_reparacion: ['listo_entrega', 'cancelado'],
    listo_entrega: ['entregado', 'cancelado'],
    entregado: [],
    cancelado: []
  };

  async updateStatus(id: number, status: RepairOrderStatus): Promise<void> {
    const order = await this.getById(id);
    if (!order) throw new Error('Orden no encontrada');
    const allowed = RepairOrderRepository.ALLOWED_TRANSITIONS[order.status as RepairOrderStatus];
    if (!allowed?.includes(status)) {
      throw new Error(`Transición de estado no permitida: ${order.status} → ${status}`);
    }
    const updates: string[] = ['status = ?'];
    const params: any[] = [status];
    if (status === 'entregado') {
      updates.push('delivery_date_actual = NOW()');
    }
    params.push(id);
    await executeQuery(
      `UPDATE repair_orders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
  }

  async getPayments(repairOrderId: number): Promise<any[]> {
    const rows = await executeQuery(
      `SELECT id, type, method, amount, currency, payment_date, status, notes, created_at, related_type, related_id
       FROM payments
       WHERE related_type = 'repair_order' AND related_id = ?
       ORDER BY payment_date DESC, id DESC`,
      [repairOrderId]
    ) as any[];
    return (rows || []).map((p: any) =>
      this.mapPaymentRow({
        ...p,
        movement_type: p.type === 'outflow' ? 'devolucion' : 'cobro',
        related_id: p.related_id ?? repairOrderId
      })
    );
  }

  async addPayment(
    repairOrderId: number,
    amount: number,
    method: string,
    paymentDateIso: string,
    userId: number | null,
    movementType: 'cobro' | 'devolucion',
    notes?: string | null
  ): Promise<{ payment: any; order: RepairOrderWithDetails | null }> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [lockRows] = await connection.execute(
        `SELECT id, status, total_amount, amount_paid FROM repair_orders WHERE id = ? FOR UPDATE`,
        [repairOrderId]
      ) as any[];
      const lockedOrder = Array.isArray(lockRows) ? lockRows[0] : lockRows;
      if (!lockedOrder) {
        await connection.rollback();
        throw new Error('Orden no encontrada');
      }
      const type = movementType === 'devolucion' ? 'outflow' : 'income';
      const defaultNote =
        movementType === 'devolucion'
          ? `Devolución orden reparación #${repairOrderId}`
          : `Pago orden reparación #${repairOrderId}`;
      const note = notes && String(notes).trim() !== '' ? String(notes).trim() : defaultNote;
      const mysqlDt = this.toMysqlDateTimeFromIso(paymentDateIso);
      const [insertHeader] = await connection.execute(
        `INSERT INTO payments (type, method, amount, currency, payment_date, status, related_type, related_id, notes, created_by)
         VALUES (?, ?, ?, 'ARS', ?, 'posted', 'repair_order', ?, ?, ?)`,
        [type, method, amount, mysqlDt, repairOrderId, note, userId]
      ) as any[];
      const insertId = (insertHeader as any).insertId;
      await this.recalcAmountPaid(connection, repairOrderId);
      await connection.commit();
      const payRows = await executeQuery(
        `SELECT id, type, method, amount, currency, payment_date, status, notes, created_at, related_type, related_id
         FROM payments WHERE id = ?`,
        [insertId]
      ) as any[];
      const payRow = Array.isArray(payRows) ? payRows[0] : payRows;
      const order = await this.getById(repairOrderId);
      return {
        payment: this.mapPaymentRow({
          ...payRow,
          movement_type: payRow?.type === 'outflow' ? 'devolucion' : 'cobro',
          related_id: payRow?.related_id ?? repairOrderId
        }),
        order
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  async getStats(): Promise<RepairOrderStats> {
    const [row] = await executeQuery(
      `SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(amount_paid), 0) as amount_paid,
        COUNT(CASE WHEN status = 'consulta_recibida' THEN 1 END) as consulta_recibida,
        COUNT(CASE WHEN status = 'presupuestado' THEN 1 END) as presupuestado,
        COUNT(CASE WHEN status = 'aceptado' THEN 1 END) as aceptado,
        COUNT(CASE WHEN status = 'en_proceso_reparacion' THEN 1 END) as en_proceso_reparacion,
        COUNT(CASE WHEN status = 'listo_entrega' THEN 1 END) as listo_entrega,
        COUNT(CASE WHEN status = 'entregado' THEN 1 END) as entregado,
        COUNT(CASE WHEN status = 'cancelado' THEN 1 END) as cancelado
       FROM repair_orders`
    ) as any[];
    const r = row || {};
    return {
      total_orders: Number(r.total_orders || 0),
      total_amount: Number(r.total_amount || 0),
      amount_paid: Number(r.amount_paid || 0),
      consulta_recibida: Number(r.consulta_recibida || 0),
      presupuestado: Number(r.presupuestado || 0),
      aceptado: Number(r.aceptado || 0),
      en_proceso_reparacion: Number(r.en_proceso_reparacion || 0),
      listo_entrega: Number(r.listo_entrega || 0),
      entregado: Number(r.entregado || 0),
      cancelado: Number(r.cancelado || 0)
    };
  }
}
