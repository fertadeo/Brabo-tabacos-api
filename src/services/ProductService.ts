import { ProductRepository } from '../repositories/ProductRepository';
import { PriceListRepository } from '../repositories/PriceListRepository';
import { Product, ProductWithCategory, CreateProductData, UpdateProductData } from '../entities/Product';
import { ProductPricesBySlug } from '../entities/PriceList';
import { WooCommerceService } from './WooCommerceService';
import { logger } from '../utils/logger';

export class ProductService {
  private productRepository: ProductRepository;
  private priceListRepository: PriceListRepository;
  private wooCommerceService: WooCommerceService;

  constructor() {
    this.productRepository = new ProductRepository();
    this.priceListRepository = new PriceListRepository();
    this.wooCommerceService = new WooCommerceService();
  }

  private async attachPrices<T extends Product>(product: T): Promise<T> {
    try {
      const prices = await this.priceListRepository.getPricesForProduct(product.id);
      return { ...product, prices };
    } catch (error) {
      // Tablas aún no migradas: degradar sin romper el catálogo
      logger.product.error('No se pudieron cargar listas de precio (¿migración pendiente?):', error);
      return {
        ...product,
        prices: {
          venta_local: Number(product.price) || 0,
          mayorista: Number(product.price) || 0,
          revendedor: Number(product.price) || 0
        }
      };
    }
  }

  private async attachPricesToMany<T extends Product>(products: T[]): Promise<T[]> {
    if (products.length === 0) return products;
    try {
      const map = await this.priceListRepository.getPricesForProducts(products.map((p) => p.id));
      return products.map((p) => ({
        ...p,
        prices: map.get(p.id) || {
          venta_local: Number(p.price) || 0,
          mayorista: Number(p.price) || 0,
          revendedor: Number(p.price) || 0
        }
      }));
    } catch (error) {
      logger.product.error('No se pudieron cargar listas de precio en lote:', error);
      return products.map((p) => ({
        ...p,
        prices: {
          venta_local: Number(p.price) || 0,
          mayorista: Number(p.price) || 0,
          revendedor: Number(p.price) || 0
        }
      }));
    }
  }

  private resolvePriceFromPayload(data: {
    price?: number;
    prices?: ProductPricesBySlug;
  }): number {
    if (data.prices?.venta_local !== undefined && data.prices.venta_local !== null) {
      const n = Number(data.prices.venta_local);
      if (Number.isFinite(n)) return n;
    }
    if (data.price !== undefined && data.price !== null) {
      const n = Number(data.price);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  private async syncProductPrices(
    productId: number,
    data: { price?: number; prices?: ProductPricesBySlug },
    existingPrices?: ProductPricesBySlug
  ): Promise<number> {
    let current = existingPrices;
    if (!current) {
      try {
        current = await this.priceListRepository.getPricesForProduct(productId);
      } catch {
        current = undefined;
      }
    }
    const fallback = this.resolvePriceFromPayload({
      price: data.price ?? current?.venta_local,
      prices: data.prices
    });
    const prices: ProductPricesBySlug = {
      venta_local: data.prices?.venta_local ?? current?.venta_local ?? fallback,
      mayorista: data.prices?.mayorista ?? current?.mayorista ?? fallback,
      revendedor: data.prices?.revendedor ?? current?.revendedor ?? fallback
    };
    return this.priceListRepository.upsertProductPrices(productId, prices, fallback);
  }

  /**
   * Normaliza un slug de WooCommerce para exponerlo en API:
   * - sin slash inicial/final
   * - lowercase
   * - sin espacios
   * - sin URL completa
   */
  private normalizeWooCommerceSlug(slug: unknown): string | null {
    if (typeof slug !== 'string') return null;
    let normalized = slug.trim();
    if (!normalized) return null;
    if (/^https?:\/\//i.test(normalized)) return null;
    normalized = normalized.replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-').toLowerCase();
    if (!normalized || normalized.includes('/') || /\s/.test(normalized)) return null;
    return normalized;
  }

  private normalizeWooCommercePermalink(permalink: unknown): string | null {
    if (typeof permalink !== 'string') return null;
    const normalized = permalink.trim();
    if (!/^https?:\/\//i.test(normalized)) return null;
    return normalized;
  }

  async getAllProducts(options: {
    page?: number;
    limit?: number;
    category_id?: number;
    search?: string;
    active_only?: boolean;
    all?: boolean;
  } = {}) {
    const result = await this.productRepository.findAll(options);
    const products = await this.attachPricesToMany(result.products);
    return { ...result, products };
  }

  async getStockSummary() {
    return await this.productRepository.getStockSummary();
  }

  async getProductById(id: number): Promise<ProductWithCategory | null> {
    const product = await this.productRepository.findById(id);
    if (!product) return null;
    return this.attachPrices(product);
  }

  /** Todos los códigos (SKU) ya existentes en el ERP. */
  async getAllProductCodes(): Promise<Set<string>> {
    return await this.productRepository.findAllCodes();
  }

  async findProductByWooCommerceId(woocommerceId: number): Promise<Product | null> {
    return this.productRepository.findByWooCommerceId(woocommerceId);
  }

  async createProduct(data: CreateProductData, syncToWooCommerce: boolean = false): Promise<Product> {
    // Verificar si el código ya existe
    const existingProduct = await this.productRepository.findByCode(data.code);
    if (existingProduct) {
      throw new Error('El código del producto ya existe');
    }

    const resolvedPrice = this.resolvePriceFromPayload(data);
    const { prices: _prices, ...createData } = data;
    const product = await this.productRepository.create({
      ...createData,
      price: resolvedPrice
    });

    try {
      await this.syncProductPrices(product.id, { price: resolvedPrice, prices: data.prices });
    } catch (error) {
      logger.product.error('Error guardando listas de precio al crear:', error);
    }

    if (syncToWooCommerce && this.wooCommerceService.isConfigured()) {
      try {
        const syncResult = await this.syncProductToWooCommerce(product.id);
        if (syncResult.created) {
          const updated = await this.productRepository.findById(product.id);
          if (updated) return this.attachPrices(updated);
        }
      } catch (error) {
        logger.product.error('Error sincronizando producto a WooCommerce tras crear:', error);
      }
    }

    return this.attachPrices(product);
  }

  async updateProduct(id: number, data: UpdateProductData, syncToWooCommerce: boolean = false): Promise<Product> {
    // Verificar si el producto existe
    const existingProduct = await this.productRepository.findById(id);
    if (!existingProduct) {
      throw new Error('Producto no encontrado');
    }

    // Si se está cambiando el código, verificar que no exista
    if (data.code && data.code !== existingProduct.code) {
      const codeExists = await this.productRepository.findByCode(data.code);
      if (codeExists) {
        throw new Error('El código del producto ya existe');
      }
    }

    // Si viene woocommerce_id en update manual, mantener consistencia de slug/permalink
    if (data.woocommerce_id !== undefined) {
      if (data.woocommerce_id === null) {
        data.woocommerce_slug = null;
        (data as any).woocommerce_permalink = null;
      } else if (this.wooCommerceService.isConfigured()) {
        const wcProduct = await this.wooCommerceService.getProduct(Number(data.woocommerce_id));
        if (!wcProduct) {
          throw new Error(`Producto WooCommerce con ID ${data.woocommerce_id} no encontrado`);
        }
        data.woocommerce_slug = wcProduct.status === 'publish'
          ? this.normalizeWooCommerceSlug(wcProduct.slug)
          : null;
        (data as any).woocommerce_permalink = wcProduct.status === 'publish'
          ? this.normalizeWooCommercePermalink(wcProduct.permalink)
          : null;
      }
    }

    // Opción A: images como lista final (reemplazo). No merge.
    // - undefined: no cambiar imágenes
    // - null o []: limpiar todas
    // - array con URLs: reemplazar por esa lista. Al cambiar imágenes, limpiar woocommerce_image_ids para que el próximo sync use URLs y actualice la galería en WC.
    if (data.images !== undefined) {
      const existingImages = Array.isArray(existingProduct.images) ? existingProduct.images : [];
      const existingIds = (existingProduct as any).woocommerce_image_ids as number[] | undefined;
      const hadIds = Array.isArray(existingIds) && existingIds.length > 0;

      if (data.images === null || (Array.isArray(data.images) && data.images.length === 0)) {
        data.images = null;
        data.woocommerce_image_ids = null;
        logger.product.images(`Producto id=${id}: galería limpiada (0 imágenes). woocommerce_image_ids limpiado para próximo sync.`);
      } else if (Array.isArray(data.images)) {
        const validUrls = data.images
          .filter((url: string) => typeof url === 'string' && url.trim().length > 0)
          .map((url: string) => url.trim());
        data.images = validUrls.length > 0 ? validUrls : null;
        data.woocommerce_image_ids = null;
        if (hadIds) {
          logger.product.images(`Producto id=${id}: galería reemplazada por ${validUrls.length} imagen(es). woocommerce_image_ids limpiado para que sync envíe URLs a WooCommerce.`);
        } else {
          logger.product.images(`Producto id=${id}: galería reemplazada por ${validUrls.length} imagen(es).`);
        }
        logger.product.images(`  Antes: ${existingImages.length} URL(s). Después: ${validUrls.length} URL(s).`, validUrls);
      }
    }

    logger.product.update(`Producto id=${id}: aplicando actualización.`, Object.keys(data).filter(k => data[k as keyof UpdateProductData] !== undefined));

    const { prices: incomingPrices, ...rest } = data;
    const updatePayload: UpdateProductData = { ...rest };
    if (incomingPrices !== undefined || data.price !== undefined) {
      updatePayload.price = this.resolvePriceFromPayload({
        price: data.price ?? existingProduct.price,
        prices: incomingPrices
      });
    }

    const hasProductFields = Object.keys(updatePayload).some(
      (k) => updatePayload[k as keyof UpdateProductData] !== undefined
    );

    let updated: Product;
    if (hasProductFields) {
      updated = await this.productRepository.update(id, updatePayload);
    } else {
      updated = existingProduct;
    }

    if (incomingPrices !== undefined || data.price !== undefined) {
      try {
        const existingPrices = (existingProduct as Product).prices;
        const synced = await this.syncProductPrices(
          id,
          {
            price: updatePayload.price ?? existingProduct.price,
            prices: incomingPrices
          },
          existingPrices
        );
        if (Number(updated.price) !== synced) {
          updated = await this.productRepository.update(id, { price: synced });
        }
      } catch (error) {
        logger.product.error('Error guardando listas de precio al actualizar:', error);
      }
    }

    if (syncToWooCommerce && existingProduct.woocommerce_id && this.wooCommerceService.isConfigured()) {
      try {
        logger.product.sync(`Producto id=${id}: iniciando sync a WooCommerce (woocommerce_id=${existingProduct.woocommerce_id}).`);
        await this.syncProductToWooCommerce(id);
        const reloaded = await this.productRepository.findById(id);
        if (reloaded) return this.attachPrices(reloaded);
      } catch (error) {
        logger.product.error('Error sincronizando producto a WooCommerce tras actualizar:', error);
      }
    }

    return this.attachPrices(updated);
  }

  async updateStock(id: number, stock: number, operation: 'set' | 'add' | 'subtract' = 'set'): Promise<Product> {
    if (typeof stock !== 'number' || stock < 0) {
      throw new Error('El stock debe ser un número positivo');
    }

    return await this.productRepository.updateStock(id, stock, operation);
  }

  async getLowStockProducts(): Promise<ProductWithCategory[]> {
    return await this.productRepository.findLowStock();
  }

  async getProductStats() {
    return await this.productRepository.getStats();
  }

  async getProductByCode(code: string): Promise<Product | null> {
    return await this.productRepository.findByCode(code);
  }

  async getWooCommerceJsonByProductId(id: number): Promise<any | null> {
    return await this.productRepository.getWooCommerceJsonById(id);
  }

  /**
   * Borrado lógico (soft delete): desactiva el producto en el ERP y, si está vinculado a WooCommerce,
   * lo mueve a la papelera de WooCommerce (no se borra definitivamente en la tienda).
   */
  async deleteProduct(id: number): Promise<{ id: number; name: string }> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    await this.productRepository.update(id, { is_active: false });
    if (product.woocommerce_id && this.wooCommerceService.isConfigured()) {
      try {
        await this.wooCommerceService.deleteProduct(product.woocommerce_id, false); // false = papelera
        logger.product.sync(`Producto id=${id}: enviado a la papelera de WooCommerce (wc_id=${product.woocommerce_id}).`);
      } catch (error) {
        logger.product.error('Error enviando producto a la papelera de WooCommerce:', error);
        // No relanzamos: el producto ya está desactivado en el ERP; el admin puede sincronizar manualmente si hace falta
      }
    }
    return { id: product.id, name: product.name };
  }

  /**
   * Borrado permanente: elimina el producto del ERP y, si está vinculado a WooCommerce,
   * lo borra definitivamente en la tienda (no solo de la papelera).
   */
  async deleteProductPermanently(id: number): Promise<{ id: number; name: string }> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    if (product.woocommerce_id && this.wooCommerceService.isConfigured()) {
      try {
        await this.wooCommerceService.deleteProduct(product.woocommerce_id, true); // true = borrado definitivo
        logger.product.sync(`Producto id=${id}: borrado permanentemente en WooCommerce (wc_id=${product.woocommerce_id}).`);
      } catch (error) {
        logger.product.error('Error borrando producto en WooCommerce (permanente):', error);
        // Opcional: relanzar para que el usuario sepa que falló en WC
      }
    }
    await this.productRepository.deleteById(id);
    return { id: product.id, name: product.name };
  }

  /**
   * Sincroniza un producto del ERP a WooCommerce (crear o actualizar).
   * Si el producto tiene woocommerce_id, actualiza en WC; si no, crea en WC y guarda el id en el ERP.
   */
  async syncProductToWooCommerce(productId: number): Promise<{ woocommerce_id: number; woocommerce_slug: string | null; woocommerce_permalink: string | null; created: boolean }> {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado. Verifica las variables de entorno.');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }

    const stock = product.stock ?? 0;
    // Combinar IDs de medios (archivos subidos) y URLs (externas o de subida): WooCommerce acepta ambos en el mismo array.
    // Así se reflejan en WooCommerce tanto las imágenes por archivo como las añadidas por URL (ej. cdn.smart-gsm.com).
    const woocommerceImageIds = (product as any).woocommerce_image_ids as number[] | undefined;
    const validIds = Array.isArray(woocommerceImageIds)
      ? woocommerceImageIds.filter((id: number) => typeof id === 'number' && id > 0)
      : [];
    const validUrls = Array.isArray(product.images)
      ? product.images.filter((url: string) => typeof url === 'string' && url.trim().length > 0)
      : [];
    const byId = validIds.map((id: number) => ({ id }));
    const bySrc = validUrls.map((url: string) => ({ src: url }));
    const imagesPayload =
      byId.length > 0 || bySrc.length > 0
        ? [...byId, ...bySrc]
        : undefined;

    if (validIds.length > 0 || validUrls.length > 0) {
      logger.product.sync(
        `Producto id=${productId}: enviando a WooCommerce ${validIds.length} imagen(es) por ID y ${validUrls.length} por URL.`,
        validIds.length > 0 ? validIds : undefined,
        validUrls.length > 0 ? validUrls.slice(0, 3).concat(validUrls.length > 3 ? ['...'] : []) : undefined
      );
    } else {
      logger.product.sync(`Producto id=${productId}: sin imágenes en payload (galería vacía o sin datos).`);
    }

    const p = product as ProductWithCategory;
    // WooCommerce requiere el ID de categoría (no solo el nombre). Las categorías vienen de WC y tienen woocommerce_id.
    // IMPORTANTE: Siempre enviar categories (incluso si es []), para que WooCommerce actualice las categorías inmediatamente.
    // Si enviamos undefined, WooCommerce puede mantener las categorías anteriores y no reflejar el cambio hasta que se limpie el caché.
    const categoriesPayload =
      p.category_woocommerce_id != null && p.category_woocommerce_id > 0
        ? [{ id: p.category_woocommerce_id }]
        : p.category_name
          ? [{ name: p.category_name }]
          : []; // Array vacío para limpiar categorías anteriores si no hay categoría asignada

    const allowBackorders = !!(product as any).allow_backorders;
    const payload: any = {
      name: product.name,
      sku: product.code,
      regular_price: String(product.price),
      description: product.description || '',
      short_description: product.description ? product.description.substring(0, 160) + (product.description.length > 160 ? '...' : '') : '',
      manage_stock: true,
      stock_quantity: stock,
      stock_status: (stock > 0 ? 'instock' : 'outofstock') as 'instock' | 'outofstock',
      backorders: allowBackorders ? 'notify' : 'no',
      status: (product.is_active ? 'publish' : 'draft') as 'publish' | 'draft',
      images: imagesPayload,
      categories: categoriesPayload,
      meta_data: [
        { key: '_brabo_erp_id', value: String(product.id) },
        { key: '_brabo_erp_code', value: product.code }
      ]
    };
    if ((product as any).weight != null && (product as any).weight !== '') {
      payload.weight = String((product as any).weight);
    }
    if ((product as any).length != null || (product as any).width != null || (product as any).height != null) {
      payload.dimensions = {
        length: String((product as any).length ?? ''),
        width: String((product as any).width ?? ''),
        height: String((product as any).height ?? '')
      };
    }

    logger.product.sync(`Producto id=${productId}: payload preparado (name, sku, price, stock, images, categories).`);

    if (product.woocommerce_id) {
      await this.wooCommerceService.updateProduct(product.woocommerce_id, payload);
      const updatedProduct = await this.wooCommerceService.getProduct(product.woocommerce_id);
      if (updatedProduct) {
        const wcSlug = updatedProduct.status === 'publish'
          ? this.normalizeWooCommerceSlug(updatedProduct.slug)
          : null;
        const wcPermalink = updatedProduct.status === 'publish'
          ? this.normalizeWooCommercePermalink(updatedProduct.permalink)
          : null;
        await this.productRepository.update(productId, {
          woocommerce_slug: wcSlug,
          woocommerce_permalink: wcPermalink
        });
        logger.product.sync(`Producto id=${productId}: actualizado en WooCommerce. Categorías:`, updatedProduct.categories?.length ?? 0);
      } else {
        await this.productRepository.update(productId, { woocommerce_slug: null, woocommerce_permalink: null });
      }
      const refreshed = await this.productRepository.findById(productId);
      return {
        woocommerce_id: product.woocommerce_id,
        woocommerce_slug: refreshed?.woocommerce_slug ?? null,
        woocommerce_permalink: (refreshed as any)?.woocommerce_permalink ?? null,
        created: false
      };
    }

    const wcProduct = await this.wooCommerceService.findProductBySku(product.code);
    if (wcProduct) {
      const wcSlug = wcProduct.status === 'publish'
        ? this.normalizeWooCommerceSlug(wcProduct.slug)
        : null;
      const wcPermalink = wcProduct.status === 'publish'
        ? this.normalizeWooCommercePermalink((wcProduct as any).permalink)
        : null;
      await this.productRepository.update(productId, {
        woocommerce_id: wcProduct.id,
        woocommerce_slug: wcSlug,
        woocommerce_permalink: wcPermalink
      });
      await this.wooCommerceService.updateProduct(wcProduct.id, payload);
      const updatedProduct = await this.wooCommerceService.getProduct(wcProduct.id);
      if (updatedProduct) {
        const syncedSlug = updatedProduct.status === 'publish'
          ? this.normalizeWooCommerceSlug(updatedProduct.slug)
          : null;
        const syncedPermalink = updatedProduct.status === 'publish'
          ? this.normalizeWooCommercePermalink(updatedProduct.permalink)
          : null;
        await this.productRepository.update(productId, {
          woocommerce_slug: syncedSlug,
          woocommerce_permalink: syncedPermalink
        });
        logger.product.sync(`Producto id=${productId}: vinculado y actualizado en WooCommerce (wc_id=${wcProduct.id}).`);
      } else {
        await this.productRepository.update(productId, { woocommerce_slug: null, woocommerce_permalink: null });
      }
      const refreshed = await this.productRepository.findById(productId);
      return {
        woocommerce_id: wcProduct.id,
        woocommerce_slug: refreshed?.woocommerce_slug ?? null,
        woocommerce_permalink: (refreshed as any)?.woocommerce_permalink ?? null,
        created: false
      };
    }

    const created = await this.wooCommerceService.createProduct(payload);
    
    // Verificar que las categorías se asignaron correctamente
    const createdProduct = await this.wooCommerceService.getProduct(created.id);
    if (createdProduct) {
      logger.product.sync(`Producto id=${productId}: creado en WooCommerce (wc_id=${created.id}). Categorías:`, createdProduct.categories?.length ?? 0);
    }
    const createdSlug = createdProduct?.status === 'publish'
      ? this.normalizeWooCommerceSlug(createdProduct.slug)
      : null;
    const createdPermalink = createdProduct?.status === 'publish'
      ? this.normalizeWooCommercePermalink(createdProduct.permalink)
      : null;
    await this.productRepository.update(productId, {
      woocommerce_id: created.id,
      woocommerce_slug: createdSlug,
      woocommerce_permalink: createdPermalink
    });
    const refreshed = await this.productRepository.findById(productId);
    return {
      woocommerce_id: created.id,
      woocommerce_slug: refreshed?.woocommerce_slug ?? null,
      woocommerce_permalink: (refreshed as any)?.woocommerce_permalink ?? null,
      created: true
    };
  }

  async linkProductToWooCommerce(productId: number, woocommerceId: number): Promise<ProductWithCategory> {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado. Verifica las variables de entorno.');
    }
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    const wcProduct = await this.wooCommerceService.getProduct(woocommerceId);
    if (!wcProduct) {
      throw new Error(`Producto WooCommerce con ID ${woocommerceId} no encontrado`);
    }
    const wcSlug = wcProduct.status === 'publish'
      ? this.normalizeWooCommerceSlug(wcProduct.slug)
      : null;
    const wcPermalink = wcProduct.status === 'publish'
      ? this.normalizeWooCommercePermalink(wcProduct.permalink)
      : null;
    await this.productRepository.update(productId, {
      woocommerce_id: woocommerceId,
      woocommerce_slug: wcSlug,
      woocommerce_permalink: wcPermalink
    });
    const updated = await this.productRepository.findById(productId);
    if (!updated) {
      throw new Error('Producto no encontrado después de vincular');
    }
    return updated;
  }

  private bulkLinkVariationDisplayName(parentName: string, variation: any): string {
    const parent = String(parentName || 'Producto').trim();
    const attrs = Array.isArray(variation?.attributes)
      ? variation.attributes
          .map((a: any) => a?.option)
          .filter((x: any) => x != null && String(x).trim() !== '')
      : [];
    const suffix = attrs.length ? attrs.join(' / ') : `#${variation?.id ?? '?'}`;
    return `${parent} — ${suffix}`;
  }

  /**
   * Vincula `woocommerce_id` en el ERP con productos de WooCommerce.
   * - Por SKU (código ERP = SKU WC) cuando hay SKU.
   * - Por `woocommerce_id` cuando el ERP ya guarda el mismo id WC (sin depender del SKU en WC).
   * - Incluye variaciones como líneas propias (mismo criterio que el import de huérfanos).
   * - Las líneas WC sin SKU y sin fila ERP con ese `woocommerce_id` aparecen en `not_found_in_erp_details` (sku null).
   */
  async bulkLinkProductsFromWooCommerce(): Promise<{
    linked: number;
    already_linked: number;
    not_found_in_erp: number;
    /** Subconjunto de not_found_in_erp donde la línea WC no tenía SKU (no se puede cruzar solo por código). */
    missing_sku_in_wc: number;
    total_processed: number;
    not_found_in_erp_details: Array<{
      sku: string | null;
      woocommerce_id: number;
      name: string;
      kind: 'simple' | 'variable_parent' | 'variation';
    }>;
    not_found_in_erp_details_truncated: boolean;
    errors: string[];
  }> {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado. Verifica las variables de entorno.');
    }

    const MAX_DETAILS = 1000;

    let linked = 0;
    let already_linked = 0;
    let not_found_in_erp = 0;
    let missing_sku_in_wc = 0;
    let lines_processed = 0;
    const errors: string[] = [];
    const not_found_in_erp_details: Array<{
      sku: string | null;
      woocommerce_id: number;
      name: string;
      kind: 'simple' | 'variable_parent' | 'variation';
    }> = [];

    const pushNotFound = (detail: {
      sku: string | null;
      woocommerce_id: number;
      name: string;
      kind: 'simple' | 'variable_parent' | 'variation';
    }): void => {
      not_found_in_erp++;
      lines_processed++;
      if (detail.sku === null || detail.sku === '') {
        missing_sku_in_wc++;
      }
      if (not_found_in_erp_details.length < MAX_DETAILS) {
        not_found_in_erp_details.push(detail);
      }
    };

    const processLine = async (line: {
      id: number;
      sku: string;
      name: string;
      slug?: string;
      permalink?: string;
      status?: string;
      kind: 'simple' | 'variable_parent' | 'variation';
    }): Promise<void> => {
      const wcId = line.id;
      const skuTrim = String(line.sku ?? '').trim();

      try {
        const erpByWcId = await this.productRepository.findByWooCommerceId(wcId);
        if (erpByWcId) {
          const wcSlug =
            line.status === 'publish' ? this.normalizeWooCommerceSlug(line.slug) : null;
          const wcPermalink =
            line.status === 'publish' ? this.normalizeWooCommercePermalink(line.permalink) : null;
          await this.productRepository.update(erpByWcId.id, {
            woocommerce_slug: wcSlug ?? erpByWcId.woocommerce_slug ?? null,
            woocommerce_permalink: wcPermalink ?? erpByWcId.woocommerce_permalink ?? null
          });
          already_linked++;
          lines_processed++;
          return;
        }

        if (skuTrim !== '') {
          const erpBySku = await this.productRepository.findByCode(skuTrim);
          if (!erpBySku) {
            pushNotFound({
              sku: skuTrim,
              woocommerce_id: wcId,
              name: line.name,
              kind: line.kind
            });
            return;
          }
          if (erpBySku.woocommerce_id) {
            if (erpBySku.woocommerce_id === wcId) {
              already_linked++;
              lines_processed++;
              return;
            }
            errors.push(
              `SKU ${skuTrim}: el ERP id=${erpBySku.id} ya está vinculado a otro WooCommerce id=${erpBySku.woocommerce_id} (actual WC línea=${wcId})`
            );
            lines_processed++;
            return;
          }
          const wcSlug =
            line.status === 'publish' ? this.normalizeWooCommerceSlug(line.slug) : null;
          const wcPermalink =
            line.status === 'publish' ? this.normalizeWooCommercePermalink(line.permalink) : null;
          await this.productRepository.update(erpBySku.id, {
            woocommerce_id: wcId,
            woocommerce_slug: wcSlug,
            woocommerce_permalink: wcPermalink
          });
          linked++;
          lines_processed++;
          return;
        }

        pushNotFound({
          sku: null,
          woocommerce_id: wcId,
          name: line.name,
          kind: line.kind
        });
      } catch (err) {
        lines_processed++;
        errors.push(
          `WC id ${wcId} (${line.kind}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };

    const perPage = 100;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const wcProducts = await this.wooCommerceService.getAllProductsPaginated(page, perPage);
      if (wcProducts.length === 0) {
        hasMore = false;
        break;
      }

      for (const wcProduct of wcProducts) {
        const ptype = String(wcProduct.type || 'simple');
        const parentName = wcProduct.name;

        if (ptype === 'variable') {
          let vpage = 1;
          let vbatch = perPage;
          while (vbatch >= perPage) {
            const variations = await this.wooCommerceService.getProductVariationsPage(
              wcProduct.id,
              vpage,
              perPage
            );
            vbatch = variations.length;
            for (const v of variations) {
              if (!v || typeof v !== 'object') continue;
              const vid = typeof v.id === 'number' ? v.id : parseInt(String(v.id), 10);
              if (!Number.isFinite(vid)) continue;
              await processLine({
                id: vid,
                sku: String(v.sku ?? ''),
                name: this.bulkLinkVariationDisplayName(parentName, v),
                slug: typeof v.slug === 'string' ? v.slug : undefined,
                permalink: typeof v.permalink === 'string' ? v.permalink : undefined,
                status: typeof v.status === 'string' ? v.status : wcProduct.status,
                kind: 'variation'
              });
            }
            vpage++;
            if (vbatch < perPage) break;
          }
        }

        await processLine({
          id: wcProduct.id,
          sku: wcProduct.sku,
          name: parentName,
          slug: wcProduct.slug,
          permalink: wcProduct.permalink,
          status: wcProduct.status,
          kind: ptype === 'variable' ? 'variable_parent' : 'simple'
        });
      }

      if (wcProducts.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return {
      linked,
      already_linked,
      not_found_in_erp,
      missing_sku_in_wc,
      total_processed: lines_processed,
      not_found_in_erp_details,
      not_found_in_erp_details_truncated: not_found_in_erp > not_found_in_erp_details.length,
      errors
    };
  }

  async backfillWooCommerceSlugs(options: { limit?: number; dry_run?: boolean } = {}) {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado. Verifica las variables de entorno.');
    }
    const limit = Math.max(1, Math.min(1000, Number(options.limit ?? 200) || 200));
    const dryRun = options.dry_run === true;
    const candidates = await this.productRepository.findLinkedMissingWooSlug(limit);

    let updated = 0;
    let not_found = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        const wcProduct = await this.wooCommerceService.getProductWithRetry(candidate.woocommerce_id, {
          retries: 3,
          baseDelayMs: 500
        });
        if (!wcProduct) {
          not_found++;
          errors.push(`Producto ERP ${candidate.id}: woocommerce_id=${candidate.woocommerce_id} no encontrado en WooCommerce`);
          continue;
        }
        const wcSlug = wcProduct.status === 'publish'
          ? this.normalizeWooCommerceSlug(wcProduct.slug)
          : null;
        const wcPermalink = wcProduct.status === 'publish'
          ? this.normalizeWooCommercePermalink(wcProduct.permalink)
          : null;
        if (!dryRun) {
          await this.productRepository.update(candidate.id, {
            woocommerce_slug: wcSlug,
            woocommerce_permalink: wcPermalink
          });
        }
        updated++;
      } catch (error) {
        failed++;
        errors.push(
          `Producto ERP ${candidate.id} (wc_id=${candidate.woocommerce_id}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      processed: candidates.length,
      updated,
      not_found,
      failed,
      dry_run: dryRun,
      errors
    };
  }
}


