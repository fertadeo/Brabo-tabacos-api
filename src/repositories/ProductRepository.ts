import { executeQuery } from '../config/database';
import { Product, ProductWithCategory, CreateProductData, UpdateProductData } from '../entities/Product';
import { normalizeIvaRate } from '../utils/ivaAlicuota';

export class ProductRepository {
  // Obtener todos los productos con paginación y filtros (evita "Out of sort memory" en tablas grandes)
  // Con all: true devuelve todos los productos sin LIMIT (para integración WooCommerce, etc.)
  async findAll(options: {
    page?: number;
    limit?: number;
    category_id?: number;
    search?: string;
    active_only?: boolean;
    all?: boolean;
  } = {}): Promise<{ products: ProductWithCategory[]; total: number }> {
    const useAll = options.all === true;
    const page = Math.max(1, parseInt(String(options.page ?? 1), 10) || 1);
    // Sin cap estricto: permitir hasta 10000 por página; all=true omite LIMIT
    const limit = useAll ? 0 : Math.min(10000, Math.max(1, parseInt(String(options.limit ?? 10), 10) || 10));
    const offset = useAll ? 0 : Math.max(0, (page - 1) * limit);

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.category_id != null) {
      conditions.push('p.category_id = ?');
      params.push(options.category_id);
    }
    if (options.search != null && String(options.search).trim() !== '') {
      conditions.push('(p.name LIKE ? OR p.code LIKE ?)');
      const searchTerm = `%${String(options.search).trim()}%`;
      params.push(searchTerm, searchTerm);
    }
    if (options.active_only === true) {
      conditions.push('p.is_active = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total con los mismos filtros (sin ORDER BY ni LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const total = Number(countResult[0]?.total ?? 0);

    // Consulta paginada (LIMIT/OFFSET como literales: algunos MySQL/drivers fallan con placeholders ?)
    const productsQuery = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.description,
        p.category_id,
        c.name as category_name,
        p.price,
        p.iva_rate,
        p.stock,
        p.min_stock,
        p.max_stock,
        p.is_active,
        p.images,
        p.woocommerce_image_ids,
        p.woocommerce_id,
        p.woocommerce_slug,
        p.woocommerce_permalink,
        p.barcode,
        p.qr_code,
        p.weight,
        p.length,
        p.width,
        p.height,
        p.allow_backorders,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name
      ${useAll ? '' : `LIMIT ${limit} OFFSET ${offset}`}
    `;
    const products = await executeQuery(productsQuery, params);

    // Parsear JSON de imágenes y woocommerce_image_ids
    const parsedProducts = (Array.isArray(products) ? products : []).map((product: any) => ProductRepository.parseProductRow(product));

    return { products: parsedProducts, total };
  }

  /**
   * Resumen de stock para integración: agregados + lista ligera de productos (sin ORDER BY pesado).
   * Evita cargar todos los productos con findAll y el error "Out of sort memory".
   */
  async getStockSummary(): Promise<{
    summary: { total_products: number; instock: number; lowstock: number; outofstock: number; total_stock_value: number };
    products: Array<{ code: string; name: string; stock: number; min_stock: number; max_stock: number; is_active: boolean; stock_status: string }>;
  }> {
    const countQuery = `
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN stock > min_stock THEN 1 ELSE 0 END) as instock,
        SUM(CASE WHEN stock <= min_stock AND stock > 0 THEN 1 ELSE 0 END) as lowstock,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as outofstock,
        COALESCE(SUM(stock * price), 0) as total_stock_value
      FROM products
      WHERE is_active = 1
    `;
    const countResult = await executeQuery(countQuery);
    const row = countResult[0] as any;
    const summary = {
      total_products: Number(row?.total_products ?? 0),
      instock: Number(row?.instock ?? 0),
      lowstock: Number(row?.lowstock ?? 0),
      outofstock: Number(row?.outofstock ?? 0),
      total_stock_value: Number(row?.total_stock_value ?? 0)
    };

    const listQuery = `
      SELECT code, name, stock, min_stock, max_stock, is_active
      FROM products
      WHERE is_active = 1
    `;
    const productsRows = await executeQuery(listQuery);
    const products = (Array.isArray(productsRows) ? productsRows : []).map((p: any) => ({
      code: p.code,
      name: p.name,
      stock: p.stock ?? 0,
      min_stock: p.min_stock ?? 0,
      max_stock: p.max_stock ?? 0,
      is_active: !!p.is_active,
      stock_status: p.stock === 0 ? 'outofstock' : (p.stock <= (p.min_stock ?? 0) ? 'lowstock' : 'instock')
    }));

    return { summary, products };
  }

  // Obtener producto por ID
  async findById(id: number): Promise<ProductWithCategory | null> {
    const query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.description,
        p.category_id,
        c.name as category_name,
        c.woocommerce_id as category_woocommerce_id,
        p.price,
        p.iva_rate,
        p.stock,
        p.min_stock,
        p.max_stock,
        p.is_active,
        p.images,
        p.woocommerce_image_ids,
        p.woocommerce_id,
        p.woocommerce_slug,
        p.woocommerce_permalink,
        p.woocommerce_json,
        p.barcode,
        p.qr_code,
        p.weight,
        p.length,
        p.width,
        p.height,
        p.allow_backorders,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `;
    
    const product = await executeQuery(query, [id]);
    if (!product[0]) return null;
    
    return ProductRepository.parseProductRow(product[0]);
  }

  /** Parsea una fila de producto (JSON, allow_backorders como boolean) */
  private static parseProductRow(row: any): any {
    const parsedWooJson = row.woocommerce_json
      ? (typeof row.woocommerce_json === 'string' ? JSON.parse(row.woocommerce_json) : row.woocommerce_json)
      : null;
    const rawWooSlug = typeof row.woocommerce_slug === 'string' ? row.woocommerce_slug.trim() : '';
    const normalizedWooSlug = rawWooSlug
      .replace(/^\/+|\/+$/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    const fallbackSlugFromJson = parsedWooJson && parsedWooJson.status === 'publish' && typeof parsedWooJson.slug === 'string'
      ? String(parsedWooJson.slug).trim().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-').toLowerCase()
      : '';
    const rawPermalink = typeof row.woocommerce_permalink === 'string' ? row.woocommerce_permalink.trim() : '';
    const fallbackPermalinkFromJson = parsedWooJson && parsedWooJson.status === 'publish' && typeof parsedWooJson.permalink === 'string'
      ? String(parsedWooJson.permalink).trim()
      : '';
    const permalinkCandidate = rawPermalink || fallbackPermalinkFromJson;
    const normalizedPermalink = /^https?:\/\//i.test(permalinkCandidate) ? permalinkCandidate : null;

    const parsed = {
      ...row,
      iva_rate: normalizeIvaRate(row.iva_rate),
      images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : null,
      woocommerce_image_ids: row.woocommerce_image_ids ? (typeof row.woocommerce_image_ids === 'string' ? JSON.parse(row.woocommerce_image_ids) : row.woocommerce_image_ids) : null,
      woocommerce_slug: row.woocommerce_id ? (normalizedWooSlug || fallbackSlugFromJson || null) : null,
      woocommerce_permalink: row.woocommerce_id ? normalizedPermalink : null,
      woocommerce_json: parsedWooJson,
      allow_backorders: row.allow_backorders === 1 || row.allow_backorders === true
    };
    return parsed;
  }

  // Obtener producto por código
  async findByBarcode(barcode: string): Promise<ProductWithCategory | null> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ?
      AND p.is_active = 1
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [barcode]) as any[];
    
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    return ProductRepository.parseProductRow(results[0]);
  }

  async findByCode(code: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE code = ?';
    const product = await executeQuery(query, [code]);
    if (!product[0]) return null;
    return ProductRepository.parseProductRow(product[0]);
  }

  /** Producto ERP ya vinculado a un id de WooCommerce (producto simple o variación). */
  async findByWooCommerceId(woocommerceId: number): Promise<Product | null> {
    if (!Number.isFinite(woocommerceId) || woocommerceId < 1) {
      return null;
    }
    const rows = await executeQuery('SELECT * FROM products WHERE woocommerce_id = ? LIMIT 1', [
      woocommerceId
    ]);
    if (!rows[0]) return null;
    return ProductRepository.parseProductRow(rows[0]);
  }

  /** Códigos (SKU) existentes en el ERP, para detectar huérfanos de WooCommerce. */
  async findAllCodes(): Promise<Set<string>> {
    const rows = (await executeQuery(
      'SELECT code FROM products WHERE code IS NOT NULL AND TRIM(code) <> ""'
    )) as { code: string }[];
    const set = new Set<string>();
    for (const row of rows) {
      const c = String(row.code ?? '').trim();
      if (c !== '') set.add(c);
    }
    return set;
  }

  // Crear producto
  async create(data: CreateProductData): Promise<Product> {
    const {
      code,
      name,
      description,
      category_id,
      price,
      iva_rate = 21,
      stock = 0,
      min_stock = 0,
      max_stock = 1000,
      images,
      woocommerce_image_ids,
      woocommerce_id,
      woocommerce_slug,
      woocommerce_permalink,
      woocommerce_json,
      barcode,
      qr_code,
      weight,
      length,
      width,
      height,
      allow_backorders = false
    } = data;

    const isActive = data.is_active === undefined ? true : !!data.is_active;
    
    const insertQuery = `
      INSERT INTO products (
        code, name, description, category_id, price, iva_rate, stock, min_stock, max_stock,
        is_active, images, woocommerce_image_ids, barcode, qr_code, woocommerce_id, woocommerce_slug, woocommerce_permalink, woocommerce_json,
        weight, length, width, height, allow_backorders
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      code,
      name,
      description ?? null,
      category_id ?? null,
      price,
      normalizeIvaRate(iva_rate),
      stock,
      min_stock,
      max_stock,
      isActive ? 1 : 0,
      images ? JSON.stringify(images) : null,
      woocommerce_image_ids ? JSON.stringify(woocommerce_image_ids) : null,
      barcode ?? null,
      qr_code ?? null,
      woocommerce_id ?? null,
      woocommerce_slug ?? null,
      woocommerce_permalink ?? null,
      woocommerce_json ? JSON.stringify(woocommerce_json) : null,
      weight ?? null,
      length ?? null,
      width ?? null,
      height ?? null,
      allow_backorders ? 1 : 0
    ]);
    
    const newProduct = await executeQuery('SELECT * FROM products WHERE id = ?', [result.insertId]);
    if (!newProduct[0]) throw new Error('Error al crear producto');
    return ProductRepository.parseProductRow(newProduct[0]);
  }

  // Actualizar producto
  async update(id: number, data: UpdateProductData): Promise<Product> {
    const fields: string[] = [];
    const values = [];
    // No son columnas de products
    const skipKeys = new Set(['prices']);

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && !skipKeys.has(key)) {
        fields.push(`${key} = ?`);
        // Convertir arrays a JSON string
        if (key === 'images' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else if (key === 'woocommerce_image_ids' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else if (key === 'woocommerce_json') {
          // Guardar JSON completo de WooCommerce como string JSON
          if (value === null) {
            values.push(null);
          } else if (typeof value === 'string') {
            values.push(value);
          } else {
            values.push(JSON.stringify(value));
          }
        } else if (key === 'allow_backorders') {
          values.push(value ? 1 : 0);
        } else if (key === 'iva_rate') {
          values.push(normalizeIvaRate(value));
        } else {
          values.push(value);
        }
      }
    });
    
    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }
    
    values.push(id);
    
    const updateQuery = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, values);
    
    const updatedProduct = await executeQuery('SELECT * FROM products WHERE id = ?', [id]);
    if (!updatedProduct[0]) throw new Error('Producto no encontrado después de actualizar');
    return ProductRepository.parseProductRow(updatedProduct[0]);
  }

  // Actualizar stock
  async updateStock(id: number, stock: number, operation: 'set' | 'add' | 'subtract' = 'set'): Promise<Product> {
    const existingProduct = await executeQuery('SELECT stock FROM products WHERE id = ?', [id]);
    
    if (!existingProduct[0]) {
      throw new Error('Producto no encontrado');
    }
    
    let newStock = stock;
    if (operation === 'add') {
      newStock = existingProduct[0].stock + stock;
    } else if (operation === 'subtract') {
      newStock = Math.max(0, existingProduct[0].stock - stock);
    }
    
    await executeQuery('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
    
    const updatedProduct = await executeQuery('SELECT * FROM products WHERE id = ?', [id]);
    if (!updatedProduct[0]) throw new Error('Producto no encontrado después de actualizar stock');
    return ProductRepository.parseProductRow(updatedProduct[0]);
  }

  // Obtener productos con stock bajo
  async findLowStock(): Promise<ProductWithCategory[]> {
    const query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.stock,
        p.min_stock,
        p.max_stock,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock <= p.min_stock AND p.is_active = 1
      ORDER BY (p.stock - p.min_stock) ASC
    `;
    
    return await executeQuery(query);
  }

  // Obtener estadísticas de productos
  async getStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
        SUM(stock) as total_stock_quantity,
        COALESCE(SUM(stock * price), 0) as total_stock_value,
        AVG(price) as average_price,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_count
      FROM products
    `;
    
    const stats = await executeQuery(query);
    return stats[0];
  }

  // Obtener SOLO el JSON completo de WooCommerce de un producto (por ID interno)
  async getWooCommerceJsonById(id: number): Promise<any | null> {
    const rows = await executeQuery('SELECT woocommerce_json FROM products WHERE id = ?', [id]) as any[];
    if (!rows[0]) return null;
    const raw = rows[0].woocommerce_json;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  /**
   * Borrado físico del producto (DELETE FROM products).
   * Usar solo para borrado permanente; para "borrar" en la app usar update con is_active = false.
   */
  async deleteById(id: number): Promise<void> {
    await executeQuery('DELETE FROM products WHERE id = ?', [id]);
  }

  async findLinkedMissingWooSlug(limit: number = 200): Promise<Array<{ id: number; woocommerce_id: number }>> {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
    const rows = await executeQuery(
      `SELECT id, woocommerce_id
       FROM products
       WHERE woocommerce_id IS NOT NULL
         AND (woocommerce_slug IS NULL OR woocommerce_slug = '')
       ORDER BY id ASC
       LIMIT ${safeLimit}`
    ) as any[];
    return (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: Number(r.id),
      woocommerce_id: Number(r.woocommerce_id)
    }));
  }
}
