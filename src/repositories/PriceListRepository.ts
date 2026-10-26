import { executeQuery } from '../config/database';
import {
  DEFAULT_PRICE_LIST_SLUG,
  KNOWN_PRICE_LIST_SLUGS,
  PriceList,
  ProductPricesBySlug
} from '../entities/PriceList';

export class PriceListRepository {
  async findAll(activeOnly = true): Promise<PriceList[]> {
    const where = activeOnly ? 'WHERE is_active = 1' : '';
    const rows = (await executeQuery(
      `SELECT id, name, slug, is_default, sort_order, is_active, created_at, updated_at
       FROM price_lists
       ${where}
       ORDER BY sort_order ASC, id ASC`
    )) as any[];
    return rows.map(this.mapRow);
  }

  async findBySlug(slug: string): Promise<PriceList | null> {
    const rows = (await executeQuery(
      `SELECT id, name, slug, is_default, sort_order, is_active, created_at, updated_at
       FROM price_lists WHERE slug = ? LIMIT 1`,
      [slug]
    )) as any[];
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findDefault(): Promise<PriceList | null> {
    const rows = (await executeQuery(
      `SELECT id, name, slug, is_default, sort_order, is_active, created_at, updated_at
       FROM price_lists WHERE is_default = 1 LIMIT 1`
    )) as any[];
    if (rows[0]) return this.mapRow(rows[0]);
    return this.findBySlug(DEFAULT_PRICE_LIST_SLUG);
  }

  async getPricesForProduct(productId: number): Promise<ProductPricesBySlug> {
    const map = await this.getPricesForProducts([productId]);
    return map.get(productId) || this.emptyPrices();
  }

  async getPricesForProducts(productIds: number[]): Promise<Map<number, ProductPricesBySlug>> {
    const result = new Map<number, ProductPricesBySlug>();
    for (const id of productIds) {
      result.set(id, this.emptyPrices());
    }
    if (productIds.length === 0) return result;

    const placeholders = productIds.map(() => '?').join(',');
    const rows = (await executeQuery(
      `SELECT pp.product_id, pl.slug, pp.price
       FROM product_prices pp
       INNER JOIN price_lists pl ON pl.id = pp.price_list_id
       WHERE pp.product_id IN (${placeholders})`,
      productIds
    )) as Array<{ product_id: number; slug: string; price: number }>;

    for (const row of rows) {
      const prices = result.get(Number(row.product_id)) || this.emptyPrices();
      prices[row.slug] = Number(row.price) || 0;
      result.set(Number(row.product_id), prices);
    }
    return result;
  }

  /**
   * Upsert precios por slug. Devuelve el precio de la lista default (venta_local)
   * para sincronizar products.price.
   */
  async upsertProductPrices(
    productId: number,
    prices: ProductPricesBySlug,
    fallbackPrice = 0
  ): Promise<number> {
    const lists = await this.findAll(false);
    const bySlug = new Map(lists.map((l) => [l.slug, l]));
    const local =
      prices.venta_local !== undefined && prices.venta_local !== null
        ? Number(prices.venta_local)
        : fallbackPrice;
    const resolvedLocal = Number.isFinite(local) ? local : 0;

    for (const slug of KNOWN_PRICE_LIST_SLUGS) {
      const list = bySlug.get(slug);
      if (!list) continue;
      const raw =
        prices[slug] !== undefined && prices[slug] !== null
          ? Number(prices[slug])
          : resolvedLocal;
      const value = Number.isFinite(raw) && raw >= 0 ? raw : 0;
      await executeQuery(
        `INSERT INTO product_prices (product_id, price_list_id, price)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE price = VALUES(price)`,
        [productId, list.id, value]
      );
    }

    return resolvedLocal;
  }

  /** Asegura filas en product_prices a partir de products.price (lista default). */
  async ensureDefaultPriceFromProduct(productId: number, price: number): Promise<void> {
    await this.upsertProductPrices(productId, { venta_local: price }, price);
  }

  private emptyPrices(): ProductPricesBySlug {
    return {
      venta_local: 0,
      mayorista: 0,
      revendedor: 0
    };
  }

  private mapRow(row: any): PriceList {
    return {
      id: Number(row.id),
      name: String(row.name),
      slug: String(row.slug),
      is_default: row.is_default === 1 || row.is_default === true,
      sort_order: Number(row.sort_order) || 0,
      is_active: row.is_active === 1 || row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
