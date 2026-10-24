import { ProductService } from './ProductService';
import { WooCommerceService } from './WooCommerceService';
import { CategoryRepository } from '../repositories/CategoryRepository';

/** Cuerpo esperado por POST /integration/products/import-woocommerce-products-draft */
export type WooCommerceDraftImportItem = {
  woocommerce_id?: number | null;
  sku?: string | null;
  name?: string | null;
  sku_missing_in_wc?: boolean;
};

export interface ImportWooCommerceOrphansResult {
  created: number;
  skipped: number;
  /** Cuántos se importaron generando código (sin SKU en WooCommerce): WC-P-{id} / WC-V-{id} */
  imported_with_generated_code: number;
  errors: number;
  /** Cantidad de productos padre WC recorridos (una vez por padre en el listado). */
  scanned_wc_products: number;
  /** Líneas WC evaluadas: simple = 1; variable = padre + cada variación. */
  wc_lines_scanned: number;
  /** Líneas donde el SKU en WooCommerce estaba vacío (se usaría código generado al crear). */
  wc_lines_with_empty_sku: number;
  dry_run: boolean;
  category_id: number;
  error_details: Array<{ code?: string; message: string }>;
  created_codes: string[];
  /** Solo en dry_run: muestra hasta 100 filas que se crearían con código generado (auditoría). */
  dry_run_missing_sku_preview?: Array<{
    woocommerce_id: number;
    parent_woocommerce_id?: number;
    name: string;
    is_variation: boolean;
    generated_code: string;
  }>;
}

/**
 * Importa a el ERP los productos publicados en WooCommerce cuyo código (SKU o generado) no existe aún en el ERP.
 * Se crean con is_active=false y category_id indicada (p. ej. categoría “Borrador”).
 * Si no hay SKU, se asigna código único WC-P-{id} (simple) o WC-V-{id} (variación).
 */
export class ImportWooCommerceOrphansService {
  private productService: ProductService;
  private wooCommerceService: WooCommerceService;
  private categoryRepository: CategoryRepository;

  constructor() {
    this.productService = new ProductService();
    this.wooCommerceService = new WooCommerceService();
    this.categoryRepository = new CategoryRepository();
  }

  async run(options: { categoryId: number; dryRun: boolean }): Promise<ImportWooCommerceOrphansResult> {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado en el servidor (variables de entorno).');
    }
    const category = await this.categoryRepository.findById(options.categoryId);
    if (!category) {
      throw new Error(`Categoría ERP id=${options.categoryId} no encontrada.`);
    }

    const erpCodes = await this.productService.getAllProductCodes();
    const PER_PAGE = 100;

    let created = 0;
    let skipped = 0;
    let imported_with_generated_code = 0;
    let errors = 0;
    let scanned_wc_products = 0;
    let wc_lines_scanned = 0;
    let wc_lines_with_empty_sku = 0;
    const error_details: Array<{ code?: string; message: string }> = [];
    const created_codes: string[] = [];
    const dry_run_missing_sku_preview: NonNullable<
      ImportWooCommerceOrphansResult['dry_run_missing_sku_preview']
    > = [];
    const PREVIEW_CAP = 100;

    let page = 1;
    let batchSize = PER_PAGE;

    while (batchSize >= PER_PAGE) {
      const products = await this.wooCommerceService.getProductsPage(page, PER_PAGE, 'publish');
      batchSize = products.length;
      if (batchSize === 0) break;

      for (const p of products) {
        scanned_wc_products++;
        const wcId = typeof p.id === 'number' ? p.id : parseInt(String(p.id), 10);
        if (!Number.isFinite(wcId)) continue;

        const full = await this.wooCommerceService.getProduct(wcId);
        if (!full) continue;

        const type = String(full.type || 'simple');

        if (type === 'variable') {
          let vpage = 1;
          let vbatch = PER_PAGE;
          while (vbatch >= PER_PAGE) {
            const variations = await this.wooCommerceService.getProductVariationsPage(wcId, vpage, PER_PAGE);
            vbatch = variations.length;
            for (const v of variations) {
              wc_lines_scanned++;
              const displayName = this.buildVariationDisplayName(full, v);
              const skuEmpty = !String((v as any)?.sku || '').trim();
              if (skuEmpty) {
                wc_lines_with_empty_sku++;
              }
              const r = await this.tryImportOne({
                wcPayload: v,
                parent: full,
                erpCodes,
                categoryId: options.categoryId,
                dryRun: options.dryRun,
                displayName,
                error_details
              });
              if (r.status === 'created') {
                created++;
                if (r.code) created_codes.push(r.code);
                if (r.generated) imported_with_generated_code++;
                if (
                  options.dryRun &&
                  skuEmpty &&
                  r.generated &&
                  r.code &&
                  dry_run_missing_sku_preview.length < PREVIEW_CAP
                ) {
                  dry_run_missing_sku_preview.push({
                    woocommerce_id: typeof v.id === 'number' ? v.id : parseInt(String(v.id), 10),
                    parent_woocommerce_id: wcId,
                    name: displayName,
                    is_variation: true,
                    generated_code: r.code
                  });
                }
              } else if (r.status === 'skipped') skipped++;
              else if (r.status === 'error') errors++;
            }
            vpage++;
          }
        } else {
          wc_lines_scanned++;
          const displayName =
            String(full.name || full.sku || '').trim() || `Producto ${wcId}`;
          const skuEmpty = !String(full.sku || '').trim();
          if (skuEmpty) {
            wc_lines_with_empty_sku++;
          }
          const r = await this.tryImportOne({
            wcPayload: full,
            parent: full,
            erpCodes,
            categoryId: options.categoryId,
            dryRun: options.dryRun,
            displayName,
            error_details
          });
          if (r.status === 'created') {
            created++;
            if (r.code) created_codes.push(r.code);
            if (r.generated) imported_with_generated_code++;
            if (
              options.dryRun &&
              skuEmpty &&
              r.generated &&
              r.code &&
              dry_run_missing_sku_preview.length < PREVIEW_CAP
            ) {
              dry_run_missing_sku_preview.push({
                woocommerce_id: wcId,
                name: displayName,
                is_variation: false,
                generated_code: r.code
              });
            }
          } else if (r.status === 'skipped') skipped++;
          else if (r.status === 'error') errors++;
        }
      }
      page++;
    }

    const result: ImportWooCommerceOrphansResult = {
      created,
      skipped,
      imported_with_generated_code,
      errors,
      scanned_wc_products,
      wc_lines_scanned,
      wc_lines_with_empty_sku,
      dry_run: options.dryRun,
      category_id: options.categoryId,
      error_details,
      created_codes
    };
    if (options.dryRun && dry_run_missing_sku_preview.length > 0) {
      result.dry_run_missing_sku_preview = dry_run_missing_sku_preview;
    }
    return result;
  }

  /**
   * Código único cuando WooCommerce no trae SKU (borrador en ERP).
   * Simple: WC-P-{productId}. Variación: WC-V-{variationId}.
   */
  private generateUniqueCode(wcPayload: any, parent: any, erpCodes: Set<string>): string {
    const wcEntityId = typeof wcPayload.id === 'number' ? wcPayload.id : parseInt(String(wcPayload.id), 10);
    const parentId = typeof parent.id === 'number' ? parent.id : parseInt(String(parent.id), 10);
    const sameEntity = Number(wcPayload.id) === Number(parent.id);
    const gen = sameEntity
      ? `WC-P-${Number.isFinite(wcEntityId) ? wcEntityId : parentId}`
      : `WC-V-${Number.isFinite(wcEntityId) ? wcEntityId : 'x'}`;
    let code = gen.length > 100 ? gen.slice(0, 100) : gen;
    let n = 2;
    while (erpCodes.has(code)) {
      code = `${gen}-${n}`.slice(0, 100);
      n++;
      if (n > 10000) break;
    }
    return code;
  }

  private buildVariationDisplayName(parent: any, variation: any): string {
    const parentName = String(parent.name || 'Producto').trim();
    const attrs = Array.isArray(variation.attributes)
      ? variation.attributes
          .map((a: any) => a?.option)
          .filter((x: any) => x != null && String(x).trim() !== '')
      : [];
    const suffix = attrs.length ? attrs.join(' / ') : `#${variation.id}`;
    return `${parentName} — ${suffix}`;
  }

  private extractImages(wc: any): string[] | null {
    if (!wc || !Array.isArray(wc.images) || wc.images.length === 0) return null;
    const urls = wc.images.map((x: any) => x?.src).filter((u: any) => typeof u === 'string' && u.length > 0);
    return urls.length ? urls : null;
  }

  private parsePrice(wc: any): number {
    const p = wc.regular_price ?? wc.price ?? '0';
    const n = parseFloat(String(p));
    return Number.isFinite(n) ? n : 0;
  }

  private parseStock(wc: any): number {
    const q = wc.stock_quantity;
    if (q === null || q === undefined) return 0;
    const n = parseInt(String(q), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  private parseDimensions(wc: any): {
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
  } {
    const weight = wc.weight != null && wc.weight !== '' ? parseFloat(String(wc.weight)) : null;
    const d = wc.dimensions || {};
    const length = d.length != null && d.length !== '' ? parseFloat(String(d.length)) : null;
    const width = d.width != null && d.width !== '' ? parseFloat(String(d.width)) : null;
    const height = d.height != null && d.height !== '' ? parseFloat(String(d.height)) : null;
    return {
      weight: weight != null && Number.isFinite(weight) ? weight : null,
      length: length != null && Number.isFinite(length) ? length : null,
      width: width != null && Number.isFinite(width) ? width : null,
      height: height != null && Number.isFinite(height) ? height : null
    };
  }

  private async tryImportOne(params: {
    wcPayload: any;
    parent: any;
    erpCodes: Set<string>;
    categoryId: number;
    dryRun: boolean;
    displayName: string;
    error_details: Array<{ code?: string; message: string }>;
    /** Borrador desde selección en front: stock 0 en ERP aunque WC tenga otro valor */
    forceStockZero?: boolean;
  }): Promise<
    | { status: 'skipped' }
    | { status: 'created'; code: string; generated: boolean }
    | { status: 'error'; code: string }
  > {
    const { wcPayload, parent, erpCodes, categoryId, dryRun, displayName, error_details, forceStockZero } = params;
    const skuRaw = String(wcPayload.sku || '').trim();
    let code: string;
    let generated = false;

    if (skuRaw !== '') {
      code = skuRaw.length > 100 ? skuRaw.slice(0, 100) : skuRaw;
      if (erpCodes.has(code)) {
        return { status: 'skipped' };
      }
    } else {
      code = this.generateUniqueCode(wcPayload, parent, erpCodes);
      generated = true;
    }

    const nameFinal =
      String(displayName || '').trim() ||
      (code.startsWith('WC-') ? `Producto WC ${code}` : `Producto ${code}`);

    const description =
      typeof wcPayload.description === 'string' && wcPayload.description.trim() !== ''
        ? wcPayload.description
        : typeof parent.description === 'string'
          ? parent.description
          : null;

    const price = this.parsePrice(wcPayload);
    const stock = forceStockZero === true ? 0 : this.parseStock(wcPayload);
    const images =
      this.extractImages(wcPayload) ?? this.extractImages(parent);
    const dims = this.parseDimensions(wcPayload);
    const wcEntityId =
      typeof wcPayload.id === 'number' ? wcPayload.id : parseInt(String(wcPayload.id), 10);
    const slug = typeof wcPayload.slug === 'string' ? wcPayload.slug : null;
    const permalink = typeof wcPayload.permalink === 'string' ? wcPayload.permalink : null;
    const allowBackorders =
      wcPayload.backorders === 'notify' || wcPayload.backorders === 'yes';

    if (dryRun) {
      return { status: 'created', code, generated };
    }

    try {
      await this.productService.createProduct(
        {
          code,
          name: nameFinal,
          description,
          category_id: categoryId,
          price,
          stock,
          min_stock: 0,
          max_stock: 1000,
          images,
          woocommerce_id: Number.isFinite(wcEntityId) ? wcEntityId : null,
          woocommerce_slug: slug,
          woocommerce_permalink: permalink,
          woocommerce_json: {
            ...wcPayload,
            _mfcomputers_import: {
              erp_code_used: code,
              sku_was_missing: generated
            }
          },
          weight: dims.weight,
          length: dims.length,
          width: dims.width,
          height: dims.height,
          allow_backorders: allowBackorders,
          is_active: false
        },
        false
      );
      erpCodes.add(code);
      return { status: 'created', code, generated };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      error_details.push({ code, message });
      return { status: 'error', code };
    }
  }

  /**
   * Importación desde el front: filas seleccionadas “sin alta en ERP” → productos borrador (inactivos, stock 0).
   * Resolución WC: prioriza woocommerce_id (getProductFlexible); si no hay payload, intenta por SKU en la API WC.
   */
  async importDraftItems(
    categoryId: number,
    items: WooCommerceDraftImportItem[]
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado en el servidor (variables de entorno).');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return { created: 0, skipped: 0, errors: [] };
    }

    const erpCodes = await this.productService.getAllProductCodes();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const error_details: Array<{ code?: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const resolved = await this.resolveWcPayloadForDraftItem(item);
      if (!resolved) {
        errors.push(
          `Ítem ${i + 1}: no se encontró en WooCommerce (indicá woocommerce_id y/o sku que exista en la tienda).`
        );
        continue;
      }

      const { wcPayload, parent, displayName } = resolved;
      const wcEntityId =
        typeof wcPayload.id === 'number' ? wcPayload.id : parseInt(String(wcPayload.id), 10);

      if (Number.isFinite(wcEntityId) && wcEntityId > 0) {
        const existingWc = await this.productService.findProductByWooCommerceId(wcEntityId);
        if (existingWc) {
          skipped++;
          continue;
        }
      }

      const r = await this.tryImportOne({
        wcPayload,
        parent,
        erpCodes,
        categoryId,
        dryRun: false,
        displayName,
        error_details,
        forceStockZero: true
      });

      if (r.status === 'created') {
        created++;
      } else if (r.status === 'skipped') {
        skipped++;
      }
    }

    for (const ed of error_details) {
      errors.push(`${ed.code ?? '?'}: ${ed.message}`);
    }

    return { created, skipped, errors };
  }

  private async resolveWcPayloadForDraftItem(
    item: WooCommerceDraftImportItem
  ): Promise<{ wcPayload: any; parent: any; displayName: string } | null> {
    const skuTrim = String(item.sku ?? '').trim();
    const widRaw = item.woocommerce_id;
    const wid = widRaw == null ? NaN : Number(widRaw);

    let p: any = null;

    if (Number.isFinite(wid) && wid > 0) {
      p = await this.wooCommerceService.getProductFlexible(wid);
      if (!p && skuTrim) {
        const bySku = await this.wooCommerceService.findProductBySku(skuTrim);
        if (bySku) {
          p = await this.wooCommerceService.getProductFlexible(
            typeof bySku.id === 'number' ? bySku.id : parseInt(String(bySku.id), 10)
          );
        }
      }
    } else if (skuTrim) {
      const bySku = await this.wooCommerceService.findProductBySku(skuTrim);
      if (bySku) {
        const bid = typeof bySku.id === 'number' ? bySku.id : parseInt(String(bySku.id), 10);
        p = await this.wooCommerceService.getProductFlexible(bid);
      }
    } else {
      return null;
    }

    if (!p) {
      return null;
    }

    let parent = p;
    const type = String(p.type || 'simple');
    if (type === 'variation') {
      const pid = p.parent_id != null ? Number(p.parent_id) : NaN;
      if (Number.isFinite(pid) && pid > 0) {
        const pr = await this.wooCommerceService.getProductFlexible(pid);
        if (pr) {
          parent = pr;
        }
      }
    }

    const displayName =
      String(item.name ?? '').trim() ||
      (type === 'variation'
        ? this.buildVariationDisplayName(parent, p)
        : String(p.name || p.sku || '').trim()) ||
      `Producto WC ${p.id}`;

    return { wcPayload: p, parent, displayName };
  }
}
