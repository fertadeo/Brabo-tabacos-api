import Database from '../config/database';
import { executeQuery } from '../config/database';
import {
  Budget,
  BudgetWithDetails,
  BudgetItem,
  CreateBudgetData,
  UpdateBudgetData,
  BudgetFilters,
  BudgetStats,
  BudgetStatus,
  BudgetLineInput
} from '../entities/Budget';
import { isCatalogSaleLine } from '../utils/saleItems';
import {
  computeBudgetTotalAmount,
  resolveBudgetCurrency
} from '../utils/budgetItems';

export class BudgetRepository {
  private db: typeof Database;

  constructor() {
    this.db = Database;
  }

  private toNull(value: unknown): unknown {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }

  private mapBudgetRow(row: any): Budget {
    return {
      ...row,
      total_amount: Number(row.total_amount),
      exchange_rate:
        row.exchange_rate != null && row.exchange_rate !== ''
          ? Number(row.exchange_rate)
          : null,
      client_id: Number(row.client_id),
      repair_order_id:
        row.repair_order_id != null && row.repair_order_id !== '' ? Number(row.repair_order_id) : null
    };
  }

  private async generateBudgetNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `BUD-${year}${month}`;

    const lastResult = (await executeQuery(
      `SELECT budget_number FROM budgets 
       WHERE budget_number LIKE ? 
       ORDER BY budget_number DESC 
       LIMIT 1`,
      [`${prefix}-%`]
    )) as any[];
    const last = lastResult[0];

    let sequence = 1;
    if (last?.budget_number) {
      const parts = String(last.budget_number).split('-');
      const lastSeq = parseInt(parts[2] || '0', 10);
      if (!Number.isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  private computeTotal(
    items: BudgetLineInput[],
    exchangeRate?: number | null
  ): number {
    return computeBudgetTotalAmount(items, exchangeRate);
  }

  private async insertBudgetItem(
    connection: Awaited<ReturnType<typeof this.db.getConnection>>,
    budgetId: number,
    item: BudgetLineInput
  ): Promise<void> {
    const totalPrice = Number(item.quantity) * Number(item.unit_price);
    const currency = resolveBudgetCurrency(item.currency);

    if (isCatalogSaleLine(item)) {
      await connection.execute(
        `INSERT INTO budget_items (budget_id, product_id, description, quantity, unit_price, currency, total_price)
         VALUES (?, ?, NULL, ?, ?, ?, ?)`,
        [budgetId, item.product_id, item.quantity, item.unit_price, currency, totalPrice]
      );
      return;
    }

    await connection.execute(
      `INSERT INTO budget_items (budget_id, product_id, description, quantity, unit_price, currency, total_price)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [budgetId, item.description, item.quantity, item.unit_price, currency, totalPrice]
    );
  }

  async createBudget(data: CreateBudgetData): Promise<BudgetWithDetails> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const budgetNumber = await this.generateBudgetNumber();
      const totalAmount = this.computeTotal(data.items, data.exchange_rate ?? null);

      const [result] = (await connection.execute(
        `INSERT INTO budgets (budget_number, client_id, repair_order_id, status, total_amount, exchange_rate, valid_until, notes)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [
          budgetNumber,
          data.client_id,
          this.toNull(data.repair_order_id ?? null),
          totalAmount,
          this.toNull(data.exchange_rate ?? null),
          this.toNull(data.valid_until),
          this.toNull(data.notes)
        ]
      )) as any[];

      const budgetId = (result as any).insertId as number;

      for (const item of data.items) {
        await this.insertBudgetItem(connection, budgetId, item);
      }

      await connection.commit();

      const full = await this.getBudgetById(budgetId);
      if (!full) throw new Error('Error creando el presupuesto');
      return full;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  async getBudgetItems(budgetId: number): Promise<BudgetItem[]> {
    const rows = (await executeQuery(
      `SELECT 
        bi.*,
        COALESCE(p.name, bi.description) AS product_name,
        p.code AS product_code
       FROM budget_items bi
       LEFT JOIN products p ON bi.product_id = p.id
       WHERE bi.budget_id = ?
       ORDER BY bi.id`,
      [budgetId]
    )) as any[];

    return (rows || []).map((r) => ({
      ...r,
      product_id: r.product_id != null ? Number(r.product_id) : null,
      description: r.description ?? null,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      currency: resolveBudgetCurrency(r.currency),
      total_price: Number(r.total_price)
    }));
  }

  async getBudgetById(id: number): Promise<BudgetWithDetails | null> {
    const rows = (await executeQuery(
      `SELECT 
        b.*,
        c.name AS client_name,
        c.code AS client_code,
        c.email AS client_email,
        c.phone AS client_phone,
        c.address AS client_address,
        c.city AS client_city,
        c.cuil_cuit AS client_cuil_cuit,
        ro.repair_number AS repair_order_number,
        ro.status AS repair_order_status,
        ro.equipment_description AS repair_order_equipment_description
       FROM budgets b
       LEFT JOIN clients c ON b.client_id = c.id
       LEFT JOIN repair_orders ro ON b.repair_order_id = ro.id
       WHERE b.id = ?`,
      [id]
    )) as any[];

    if (!rows?.length) return null;

    const b = this.mapBudgetRow(rows[0]);
    const detail: BudgetWithDetails = {
      ...b,
      client_name: rows[0].client_name,
      client_code: rows[0].client_code,
      client_email: rows[0].client_email,
      client_phone: rows[0].client_phone,
      client_address: rows[0].client_address,
      client_city: rows[0].client_city,
      client_cuil_cuit: rows[0].client_cuil_cuit,
      repair_order_number: rows[0].repair_order_number ?? null,
      repair_order_status: rows[0].repair_order_status ?? null,
      repair_order_equipment_description: rows[0].repair_order_equipment_description ?? null
    };
    detail.items = await this.getBudgetItems(id);
    return detail;
  }

  async getAllBudgets(filters: BudgetFilters = {}): Promise<{
    budgets: BudgetWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, parseInt(String(filters.page ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit ?? 20), 10) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.client_id) {
      whereClause += ' AND b.client_id = ?';
      params.push(filters.client_id);
    }

    if (filters.repair_order_id) {
      whereClause += ' AND b.repair_order_id = ?';
      params.push(filters.repair_order_id);
    }

    if (filters.status) {
      whereClause += ' AND b.status = ?';
      params.push(filters.status);
    }

    if (filters.date_from) {
      whereClause += ' AND DATE(b.created_at) >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ' AND DATE(b.created_at) <= ?';
      params.push(filters.date_to);
    }

    const countResult = (await executeQuery(
      `SELECT COUNT(*) AS total FROM budgets b ${whereClause}`,
      params
    )) as any[];
    const total = countResult[0]?.total || 0;

    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    const list = (await executeQuery(
      `SELECT 
        b.*,
        c.name AS client_name,
        c.code AS client_code,
        c.email AS client_email,
        c.phone AS client_phone,
        c.address AS client_address,
        c.city AS client_city,
        c.cuil_cuit AS client_cuil_cuit,
        ro.repair_number AS repair_order_number,
        ro.status AS repair_order_status,
        (SELECT COUNT(*) FROM budget_items bi WHERE bi.budget_id = b.id) AS item_count
       FROM budgets b
       LEFT JOIN clients c ON b.client_id = c.id
       LEFT JOIN repair_orders ro ON b.repair_order_id = ro.id
       ${whereClause}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      params
    )) as any[];

    const budgets: BudgetWithDetails[] = (list || []).map((row) => {
      const mapped = this.mapBudgetRow(row);
      return {
        ...mapped,
        client_name: row.client_name,
        client_code: row.client_code,
        client_email: row.client_email,
        client_phone: row.client_phone,
        client_address: row.client_address,
        client_city: row.client_city,
        client_cuil_cuit: row.client_cuil_cuit,
        repair_order_number: row.repair_order_number ?? null,
        repair_order_status: row.repair_order_status ?? null,
        item_count: Number(row.item_count || 0)
      };
    });

    return { budgets, total, page, limit };
  }

  async getStats(): Promise<BudgetStats> {
    const rows = (await executeQuery(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
        COALESCE(SUM(CASE WHEN status = 'draft' THEN total_amount ELSE 0 END), 0) AS total_amount_draft,
        COALESCE(SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END), 0) AS total_amount_sent
       FROM budgets`
    )) as any[];

    const r = rows[0] || {};
    return {
      total: Number(r.total || 0),
      draft: Number(r.draft || 0),
      sent: Number(r.sent || 0),
      approved: Number(r.approved || 0),
      rejected: Number(r.rejected || 0),
      expired: Number(r.expired || 0),
      total_amount_draft: Number(r.total_amount_draft || 0),
      total_amount_sent: Number(r.total_amount_sent || 0)
    };
  }

  async updateBudgetDraft(id: number, data: UpdateBudgetData): Promise<BudgetWithDetails> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const [currentRows] = (await connection.execute(
        `SELECT id, status, exchange_rate FROM budgets WHERE id = ? FOR UPDATE`,
        [id]
      )) as any[];
      if (!currentRows?.length) {
        throw new Error('Presupuesto no encontrado');
      }
      if (currentRows[0].status !== 'draft') {
        throw new Error('Solo se puede editar un presupuesto en estado borrador');
      }

      const fields: string[] = [];
      const values: unknown[] = [];

      if (data.repair_order_id !== undefined) {
        fields.push('repair_order_id = ?');
        values.push(this.toNull(data.repair_order_id));
      }
      if (data.client_id !== undefined) {
        fields.push('client_id = ?');
        values.push(data.client_id);
      }
      if (data.valid_until !== undefined) {
        fields.push('valid_until = ?');
        values.push(this.toNull(data.valid_until));
      }
      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(this.toNull(data.notes));
      }

      if (data.items !== undefined) {
        if (!data.items.length) {
          throw new Error('El presupuesto debe tener al menos un ítem');
        }
        const effectiveExchangeRate =
          data.exchange_rate !== undefined
            ? data.exchange_rate
            : currentRows[0].exchange_rate != null
              ? Number(currentRows[0].exchange_rate)
              : null;
        const totalAmount = this.computeTotal(data.items, effectiveExchangeRate);
        fields.push('total_amount = ?');
        values.push(totalAmount);
        if (data.exchange_rate !== undefined) {
          fields.push('exchange_rate = ?');
          values.push(this.toNull(data.exchange_rate));
        }

        await connection.execute(`DELETE FROM budget_items WHERE budget_id = ?`, [id]);
        for (const item of data.items) {
          await this.insertBudgetItem(connection, id, item);
        }
      } else if (data.exchange_rate !== undefined) {
        fields.push('exchange_rate = ?');
        values.push(this.toNull(data.exchange_rate));
      }

      if (fields.length) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await connection.execute(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      await connection.commit();

      const full = await this.getBudgetById(id);
      if (!full) throw new Error('Presupuesto no encontrado tras actualizar');
      return full;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  async updateBudgetMetadata(
    id: number,
    data: { client_id?: number; notes?: string | null; valid_until?: string | null }
  ): Promise<BudgetWithDetails> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = (await connection.execute(
        `SELECT id, status, repair_order_id FROM budgets WHERE id = ?`,
        [id]
      )) as any[];
      if (!rows?.length) throw new Error('Presupuesto no encontrado');
      const status = rows[0].status as string;
      if (status !== 'sent' && status !== 'approved') {
        throw new Error('Solo se pueden corregir metadatos en presupuestos enviados o aprobados');
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      if (data.client_id !== undefined) {
        fields.push('client_id = ?');
        values.push(data.client_id);
      }
      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(this.toNull(data.notes));
      }
      if (data.valid_until !== undefined) {
        fields.push('valid_until = ?');
        values.push(this.toNull(data.valid_until));
      }
      if (!fields.length) {
        const full = await this.getBudgetById(id);
        if (!full) throw new Error('Presupuesto no encontrado');
        return full;
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await connection.execute(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, values);

      const full = await this.getBudgetById(id);
      if (!full) throw new Error('Presupuesto no encontrado');
      return full;
    } finally {
      connection.release();
    }
  }

  async setStatus(id: number, status: BudgetStatus): Promise<void> {
    await executeQuery(
      `UPDATE budgets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );
  }

  async deleteBudgetDraft(id: number): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = (await connection.execute(
        `SELECT status FROM budgets WHERE id = ? FOR UPDATE`,
        [id]
      )) as any[];
      if (!rows?.length) {
        throw new Error('Presupuesto no encontrado');
      }
      if (rows[0].status !== 'draft') {
        throw new Error('Solo se pueden eliminar presupuestos en borrador');
      }
      await connection.execute(`DELETE FROM budget_items WHERE budget_id = ?`, [id]);
      await connection.execute(`DELETE FROM budgets WHERE id = ?`, [id]);
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }
}
