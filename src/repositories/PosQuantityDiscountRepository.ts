import { executeQuery } from '../config/database';
import {
  CreatePosQuantityDiscountData,
  PosDiscountThresholdType,
  PosDiscountType,
  PosQuantityDiscount,
  UpdatePosQuantityDiscountData
} from '../entities/PosQuantityDiscount';

function asThresholdType(v: unknown): PosDiscountThresholdType {
  return v === 'amount' ? 'amount' : 'quantity';
}

function asDiscountType(v: unknown): PosDiscountType {
  return v === 'fixed' ? 'fixed' : 'percent';
}

export class PosQuantityDiscountRepository {
  private mapRow(row: any): PosQuantityDiscount {
    return {
      id: Number(row.id),
      name: String(row.name),
      threshold_type: asThresholdType(row.threshold_type),
      min_quantity: Number(row.min_quantity) || 1,
      min_amount: Number(row.min_amount) || 0,
      discount_type: asDiscountType(row.discount_type),
      discount_percent: Number(row.discount_percent) || 0,
      discount_amount: Number(row.discount_amount) || 0,
      price_list_slug:
        row.price_list_slug == null || row.price_list_slug === ''
          ? null
          : String(row.price_list_slug),
      is_active: Boolean(row.is_active),
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    };
  }

  private readonly cols = `id, name, threshold_type, min_quantity, min_amount, discount_type,
    discount_percent, discount_amount, price_list_slug, is_active, sort_order, created_at, updated_at`;

  async findAll(activeOnly = false): Promise<PosQuantityDiscount[]> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const rows = (await executeQuery(
      `SELECT ${this.cols}
       FROM pos_quantity_discounts
       ${where}
       ORDER BY sort_order ASC, min_quantity ASC, min_amount ASC, id ASC`
    )) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: number): Promise<PosQuantityDiscount | null> {
    const rows = (await executeQuery(
      `SELECT ${this.cols}
       FROM pos_quantity_discounts WHERE id = ? LIMIT 1`,
      [id]
    )) as any[];
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(data: CreatePosQuantityDiscountData): Promise<PosQuantityDiscount> {
    const thresholdType = asThresholdType(data.threshold_type);
    const discountType = asDiscountType(data.discount_type);
    const result = (await executeQuery(
      `INSERT INTO pos_quantity_discounts
        (name, threshold_type, min_quantity, min_amount, discount_type, discount_percent, discount_amount, price_list_slug, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name.trim(),
        thresholdType,
        Math.max(1, Math.floor(Number(data.min_quantity) || 1)),
        Math.max(0, Number(data.min_amount) || 0),
        discountType,
        Number(data.discount_percent) || 0,
        Math.max(0, Number(data.discount_amount) || 0),
        data.price_list_slug?.trim() || null,
        data.is_active === false ? 0 : 1,
        Number(data.sort_order) || 0
      ]
    )) as { insertId: number };

    const created = await this.findById(result.insertId);
    if (!created) throw new Error('No se pudo crear el descuento');
    return created;
  }

  async update(id: number, data: UpdatePosQuantityDiscountData): Promise<PosQuantityDiscount> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Descuento no encontrado');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const thresholdType =
      data.threshold_type !== undefined
        ? asThresholdType(data.threshold_type)
        : existing.threshold_type;
    const minQty =
      data.min_quantity !== undefined
        ? Math.max(1, Math.floor(Number(data.min_quantity) || 1))
        : existing.min_quantity;
    const minAmount =
      data.min_amount !== undefined
        ? Math.max(0, Number(data.min_amount) || 0)
        : existing.min_amount;
    const discountType =
      data.discount_type !== undefined ? asDiscountType(data.discount_type) : existing.discount_type;
    const pct =
      data.discount_percent !== undefined
        ? Number(data.discount_percent)
        : existing.discount_percent;
    const amount =
      data.discount_amount !== undefined
        ? Math.max(0, Number(data.discount_amount) || 0)
        : existing.discount_amount;
    const slug =
      data.price_list_slug !== undefined
        ? data.price_list_slug?.trim() || null
        : existing.price_list_slug;
    const active =
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active ? 1 : 0;
    const sort =
      data.sort_order !== undefined ? Number(data.sort_order) || 0 : existing.sort_order;

    await executeQuery(
      `UPDATE pos_quantity_discounts
       SET name = ?, threshold_type = ?, min_quantity = ?, min_amount = ?, discount_type = ?,
           discount_percent = ?, discount_amount = ?, price_list_slug = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [name, thresholdType, minQty, minAmount, discountType, pct, amount, slug, active, sort, id]
    );

    const updated = await this.findById(id);
    if (!updated) throw new Error('Descuento no encontrado tras actualizar');
    return updated;
  }

  async delete(id: number): Promise<boolean> {
    const result = (await executeQuery(
      `DELETE FROM pos_quantity_discounts WHERE id = ?`,
      [id]
    )) as { affectedRows: number };
    return (result.affectedRows || 0) > 0;
  }
}
