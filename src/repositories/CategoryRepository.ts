import { executeQuery } from '../config/database';
import { Category, CreateCategoryData } from '../entities/Category';

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    const rows = await executeQuery(
      `SELECT id, name, description, is_active, woocommerce_id, woocommerce_slug, 
              parent_id, created_at, updated_at 
       FROM categories 
       WHERE is_active = 1 
       ORDER BY name ASC`
    ) as any[];
    
    return rows.map(this.mapRowToCategory);
  }

  async findAllIncludingInactive(): Promise<Category[]> {
    const rows = await executeQuery(
      `SELECT id, name, description, is_active, woocommerce_id, woocommerce_slug, 
              parent_id, created_at, updated_at 
       FROM categories 
       ORDER BY name ASC`
    ) as any[];
    
    return rows.map(this.mapRowToCategory);
  }

  async findById(id: number): Promise<Category | null> {
    const rows = await executeQuery(
      `SELECT id, name, description, is_active, woocommerce_id, woocommerce_slug, 
              parent_id, created_at, updated_at 
       FROM categories 
       WHERE id = ?`,
      [id]
    ) as any[];
    
    return rows.length > 0 ? this.mapRowToCategory(rows[0]) : null;
  }

  async findByWooCommerceId(woocommerceId: number): Promise<Category | null> {
    const rows = await executeQuery(
      `SELECT id, name, description, is_active, woocommerce_id, woocommerce_slug, 
              parent_id, created_at, updated_at 
       FROM categories 
       WHERE woocommerce_id = ?`,
      [woocommerceId]
    ) as any[];
    
    return rows.length > 0 ? this.mapRowToCategory(rows[0]) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const rows = await executeQuery(
      `SELECT id, name, description, is_active, woocommerce_id, woocommerce_slug, 
              parent_id, created_at, updated_at 
       FROM categories 
       WHERE name = ?`,
      [name]
    ) as any[];
    
    return rows.length > 0 ? this.mapRowToCategory(rows[0]) : null;
  }

  async create(data: CreateCategoryData & { woocommerce_id?: number; woocommerce_slug?: string; parent_id?: number | null }): Promise<Category> {
    const result = await executeQuery(
      `INSERT INTO categories (name, description, woocommerce_id, woocommerce_slug, parent_id, is_active) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [data.name, data.description || null, data.woocommerce_id || null, data.woocommerce_slug || null, data.parent_id || null]
    ) as any;
    
    const category = await this.findById(result.insertId);
    if (!category) throw new Error('Error al crear categoría');
    return category;
  }

  async update(id: number, data: Partial<CreateCategoryData> & { woocommerce_id?: number; woocommerce_slug?: string; parent_id?: number | null; is_active?: boolean }): Promise<Category> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.woocommerce_id !== undefined) {
      updates.push('woocommerce_id = ?');
      values.push(data.woocommerce_id);
    }
    if (data.woocommerce_slug !== undefined) {
      updates.push('woocommerce_slug = ?');
      values.push(data.woocommerce_slug);
    }
    if (data.parent_id !== undefined) {
      updates.push('parent_id = ?');
      values.push(data.parent_id);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      const category = await this.findById(id);
      if (!category) throw new Error('Categoría no encontrada');
      return category;
    }

    values.push(id);
    await executeQuery(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const category = await this.findById(id);
    if (!category) throw new Error('Categoría no encontrada');
    return category;
  }

  private mapRowToCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      is_active: Boolean(row.is_active),
      woocommerce_id: row.woocommerce_id || undefined,
      woocommerce_slug: row.woocommerce_slug || undefined,
      parent_id: row.parent_id || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at
    };
  }
}