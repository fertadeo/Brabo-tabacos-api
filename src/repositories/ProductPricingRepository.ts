import { executeQuery } from '../config/database';

export interface CategoryProductCount {
  category_id: number | null;
  category_name: string;
  product_count: number;
}

export interface ProductPricePreviewRow {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category_name: string | null;
  current_price: number;
  new_price: number;
}

const CONFIG_LAST_USD_RATE = 'last_usd_ars_rate';

export class ProductPricingRepository {
  async getConfigNumber(key: string, defaultValue = 0): Promise<number> {
    const rows = await executeQuery(
      'SELECT config_value, config_type FROM products_config WHERE config_key = ? AND is_active = 1 LIMIT 1',
      [key]
    ) as Array<{ config_value: string; config_type: string }>;
    if (!rows[0]) return defaultValue;
    const raw = rows[0].config_value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }

  async setConfigNumber(key: string, value: number, description?: string): Promise<void> {
    await executeQuery(
      `INSERT INTO products_config (config_key, config_value, config_type, description, is_active)
       VALUES (?, ?, 'number', ?, 1)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = CURRENT_TIMESTAMP`,
      [key, String(value), description ?? null]
    );
  }

  async getLastUsdArsRate(): Promise<number> {
    return this.getConfigNumber(CONFIG_LAST_USD_RATE, 0);
  }

  async setLastUsdArsRate(rate: number): Promise<void> {
    await this.setConfigNumber(
      CONFIG_LAST_USD_RATE,
      rate,
      'Última cotización USD/ARS (venta) aplicada al confirmar ajuste por dólar'
    );
  }

  async getCategoryProductCounts(activeOnly = true): Promise<CategoryProductCount[]> {
    const activeClause = activeOnly ? 'AND p.is_active = 1' : '';
    const rows = await executeQuery(
      `SELECT
         p.category_id,
         COALESCE(c.name, 'Sin categoría') AS category_name,
         COUNT(*) AS product_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE 1=1 ${activeClause}
       GROUP BY p.category_id, c.name
       ORDER BY category_name ASC`
    ) as Array<{ category_id: number | null; category_name: string; product_count: number }>;

    return (Array.isArray(rows) ? rows : []).map((r) => ({
      category_id: r.category_id == null ? null : Number(r.category_id),
      category_name: r.category_name,
      product_count: Number(r.product_count)
    }));
  }

  async countProductsForCategories(
    categoryIds: number[],
    includeUncategorized: boolean,
    activeOnly = true
  ): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (activeOnly) {
      conditions.push('is_active = 1');
    }

    const categoryFilters: string[] = [];
    if (categoryIds.length > 0) {
      categoryFilters.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
      params.push(...categoryIds);
    }
    if (includeUncategorized) {
      categoryFilters.push('category_id IS NULL');
    }

    if (categoryFilters.length === 0) {
      return 0;
    }

    conditions.push(`(${categoryFilters.join(' OR ')})`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await executeQuery(
      `SELECT COUNT(*) AS total FROM products ${where}`,
      params
    ) as Array<{ total: number }>;
    return Number(rows[0]?.total ?? 0);
  }

  async applyPercentageByCategories(
    categoryIds: number[],
    percentage: number,
    options: { includeUncategorized?: boolean; activeOnly?: boolean } = {}
  ): Promise<number> {
    const { includeUncategorized = false, activeOnly = true } = options;
    const multiplier = 1 + percentage / 100;

    const conditions: string[] = [];
    const params: unknown[] = [multiplier];

    if (activeOnly) {
      conditions.push('is_active = 1');
    }

    const categoryFilters: string[] = [];
    if (categoryIds.length > 0) {
      categoryFilters.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
      params.push(...categoryIds);
    }
    if (includeUncategorized) {
      categoryFilters.push('category_id IS NULL');
    }

    if (categoryFilters.length === 0) {
      return 0;
    }

    conditions.push(`(${categoryFilters.join(' OR ')})`);
    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await executeQuery(
      `UPDATE products SET price = ROUND(price * ?, 2) ${where}`,
      params
    );
    return Number((result as { affectedRows?: number }).affectedRows ?? 0);
  }

  async countActiveProducts(activeOnly = true): Promise<number> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const rows = await executeQuery(
      `SELECT COUNT(*) AS total FROM products ${where}`
    ) as Array<{ total: number }>;
    return Number(rows[0]?.total ?? 0);
  }

  async applyDollarMultiplier(multiplier: number, activeOnly = true): Promise<number> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const params = [multiplier];
    const result = await executeQuery(
      `UPDATE products SET price = ROUND(price * ?, 2) ${where}`,
      params
    );
    return Number((result as { affectedRows?: number }).affectedRows ?? 0);
  }

  async getPricePreviewSample(
    limit: number,
    options: {
      categoryIds?: number[];
      includeUncategorized?: boolean;
      percentage?: number;
      dollarMultiplier?: number;
      activeOnly?: boolean;
    } = {}
  ): Promise<ProductPricePreviewRow[]> {
    const {
      categoryIds = [],
      includeUncategorized = false,
      percentage,
      dollarMultiplier,
      activeOnly = true
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (activeOnly) {
      conditions.push('p.is_active = 1');
    }

    if (percentage != null && (categoryIds.length > 0 || includeUncategorized)) {
      const categoryFilters: string[] = [];
      if (categoryIds.length > 0) {
        categoryFilters.push(`p.category_id IN (${categoryIds.map(() => '?').join(',')})`);
        params.push(...categoryIds);
      }
      if (includeUncategorized) {
        categoryFilters.push('p.category_id IS NULL');
      }
      conditions.push(`(${categoryFilters.join(' OR ')})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

    let newPriceExpr = 'p.price';
    if (percentage != null) {
      newPriceExpr = 'ROUND(p.price * ?, 2)';
      params.unshift(1 + percentage / 100);
    } else if (dollarMultiplier != null) {
      newPriceExpr = 'ROUND(p.price * ?, 2)';
      params.unshift(dollarMultiplier);
    }

    const rows = await executeQuery(
      `SELECT
         p.id,
         p.code,
         p.name,
         p.category_id,
         c.name AS category_name,
         p.price AS current_price,
         ${newPriceExpr} AS new_price
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY p.name ASC
       LIMIT ${safeLimit}`,
      params
    ) as ProductPricePreviewRow[];

    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      category_id: r.category_id == null ? null : Number(r.category_id),
      category_name: r.category_name ?? null,
      current_price: Number(r.current_price),
      new_price: Number(r.new_price)
    }));
  }

  async findLinkedProductsForWooSync(activeOnly = true): Promise<Array<{ id: number; woocommerce_id: number; price: number }>> {
    const activeClause = activeOnly ? 'AND is_active = 1' : '';
    const rows = await executeQuery(
      `SELECT id, woocommerce_id, price
       FROM products
       WHERE woocommerce_id IS NOT NULL ${activeClause}`
    ) as Array<{ id: number; woocommerce_id: number; price: number }>;
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      woocommerce_id: Number(r.woocommerce_id),
      price: Number(r.price)
    }));
  }
}
