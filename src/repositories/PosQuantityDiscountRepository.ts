import { executeQuery } from '../config/database';
import {
  CreatePosQuantityDiscountData,
  PosQuantityDiscount,
  UpdatePosQuantityDiscountData
} from '../entities/PosQuantityDiscount';

export class PosQuantityDiscountRepository {
  private mapRow(row: any): PosQuantityDiscount {
    return {
      id: Number(row.id),
      name: String(row.name),
      min_quantity: Number(row.min_quantity),
      discount_percent: Number(row.discount_percent),
      price_list_slug: row.price_list_slug == null || row.price_list_slug === ''
        ? null
        : String(row.price_list_slug),
      is_active: Boolean(row.is_active),
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    };
  }

  async findAll(activeOnly = false): Promise<PosQuantityDiscount[]> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const rows = (await executeQuery(
      `SELECT id, name, min_quantity, discount_percent, price_list_slug, is_active, sort_order, created_at, updated_at
       FROM pos_quantity_discounts
       ${where}
       ORDER BY min_quantity ASC, sort_order ASC, id ASC`
    )) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: number): Promise<PosQuantityDiscount | null> {
    const rows = (await executeQuery(
      `SELECT id, name, min_quantity, discount_percent, price_list_slug, is_active, sort_order, created_at, updated_at
       FROM pos_quantity_discounts WHERE id = ? LIMIT 1`,
      [id]
    )) as any[];
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(data: CreatePosQuantityDiscountData): Promise<PosQuantityDiscount> {
    const result = (await executeQuery(
      `INSERT INTO pos_quantity_discounts
        (name, min_quantity, discount_percent, price_list_slug, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name.trim(),
        Math.max(1, Math.floor(Number(data.min_quantity) || 1)),
        Number(data.discount_percent) || 0,
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
    const minQty =
      data.min_quantity !== undefined
        ? Math.max(1, Math.floor(Number(data.min_quantity) || 1))
        : existing.min_quantity;
    const pct =
      data.discount_percent !== undefined
        ? Number(data.discount_percent)
        : existing.discount_percent;
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
       SET name = ?, min_quantity = ?, discount_percent = ?, price_list_slug = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [name, minQty, pct, slug, active, sort, id]
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
