import { ProductService } from './ProductService';
import { CategoryService } from './CategoryService';
import { ProductRepository } from '../repositories/ProductRepository';
import { ProductPricesBySlug } from '../entities/PriceList';
import { Product } from '../entities/Product';
import { logger } from '../utils/logger';

export interface ProductImportItemInput {
  name?: string | null;
  code?: string | null;
  category?: string | null;
  category_id?: number | null;
  price?: number | null;
  prices?: Partial<ProductPricesBySlug> | null;
  iva_rate?: number | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  description?: string | null;
  is_active?: boolean | null;
  allow_backorders?: boolean | null;
}

export interface ProductImportOptions {
  dry_run?: boolean;
  /** Crear categoría si viene por nombre y no existe. Default true. */
  create_missing_categories?: boolean;
  /** Si el código ya existe: skip | update. Default skip. */
  on_duplicate_code?: 'skip' | 'update';
  /** Prefijo para códigos autogenerados. Default IMP. */
  code_prefix?: string;
  /** Si no hay ningún precio, activar igual. Default false (queda borrador). */
  activate_without_price?: boolean;
  /** IVA por defecto. Default 21. */
  default_iva_rate?: number;
}

export interface ProductImportRowResult {
  index: number;
  status: 'created' | 'updated' | 'skipped' | 'error' | 'would_create' | 'would_update' | 'would_skip';
  code?: string;
  name?: string;
  product_id?: number;
  category_id?: number | null;
  prices?: ProductPricesBySlug;
  warnings: string[];
  error?: string;
}

export interface ProductImportResult {
  dry_run: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rows: ProductImportRowResult[];
}

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Soporta 1.234,56 | 1234.56 | 8.640.00
  let normalized = String(v).trim().replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if ((normalized.match(/\./g) || []).length >= 2) {
    const parts = normalized.split('.');
    if (parts[parts.length - 1].length === 2) {
      normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else {
      normalized = parts.join('');
    }
  } else {
    normalized = normalized.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function slugCodePart(text: string, max = 12): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return base || 'PROD';
}

function resolvePrices(item: ProductImportItemInput): {
  prices: ProductPricesBySlug;
  warnings: string[];
  hasAnyPrice: boolean;
} {
  const warnings: string[] = [];
  const local = toNum(item.prices?.venta_local) ?? toNum(item.price);
  const mayorista = toNum(item.prices?.mayorista);
  const revendedor = toNum(item.prices?.revendedor);

  const first =
    [local, mayorista, revendedor].find((n) => n !== undefined && n !== null && Number.isFinite(n) && (n as number) >= 0) ??
    undefined;

  const hasAnyPrice = first !== undefined;
  if (!hasAnyPrice) {
    warnings.push('Sin precio: se guarda en 0 (borrador si no se fuerza activación)');
  } else {
    if (local === undefined) warnings.push('venta_local ausente: se completa con el precio disponible');
    if (mayorista === undefined) warnings.push('mayorista ausente: se completa con el precio disponible');
    if (revendedor === undefined) warnings.push('revendedor ausente: se completa con el precio disponible');
  }

  const fill = hasAnyPrice ? Number(first) : 0;
  return {
    hasAnyPrice,
    warnings,
    prices: {
      venta_local: local ?? fill,
      mayorista: mayorista ?? fill,
      revendedor: revendedor ?? fill
    }
  };
}

export class ProductImportService {
  private productService: ProductService;
  private categoryService: CategoryService;
  private productRepository: ProductRepository;

  constructor() {
    this.productService = new ProductService();
    this.categoryService = new CategoryService();
    this.productRepository = new ProductRepository();
  }

  async importProducts(
    items: ProductImportItemInput[],
    options: ProductImportOptions = {}
  ): Promise<ProductImportResult> {
    const dryRun = options.dry_run === true;
    const createMissingCategories = options.create_missing_categories !== false;
    const onDuplicate = options.on_duplicate_code === 'update' ? 'update' : 'skip';
    const codePrefix = (options.code_prefix || 'IMP').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'IMP';
    const activateWithoutPrice = options.activate_without_price === true;
    const defaultIva = toNum(options.default_iva_rate) ?? 21;

    const existingCodes = await this.productRepository.findAllCodes();
    const categoryCache = new Map<string, number>(); // lower name -> id

    // preload categories
    try {
      const { categories } = await this.categoryService.getAllCategories();
      for (const c of categories) {
        categoryCache.set(c.name.trim().toLowerCase(), c.id);
      }
    } catch (e) {
      logger.product.error('Import: no se pudieron precargar categorías', e);
    }

    let autoSeq = 1;
    const rows: ProductImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const nextUniqueCode = (hint?: string) => {
      while (autoSeq < 1_000_000) {
        const part = hint ? slugCodePart(hint, 10) : 'AUTO';
        const code = `${codePrefix}-${part}-${String(autoSeq).padStart(4, '0')}`.slice(0, 20);
        autoSeq += 1;
        if (!existingCodes.has(code)) {
          existingCodes.add(code);
          return code;
        }
      }
      const fallback = `${codePrefix}-${Date.now()}`.slice(0, 20);
      existingCodes.add(fallback);
      return fallback;
    };

    const resolveCategoryId = async (
      item: ProductImportItemInput,
      warnings: string[]
    ): Promise<number | null> => {
      if (item.category_id != null && Number.isFinite(Number(item.category_id))) {
        return Number(item.category_id);
      }
      const catName = String(item.category ?? '').trim();
      if (!catName) return null;

      const key = catName.toLowerCase();
      if (categoryCache.has(key)) return categoryCache.get(key)!;

      if (!createMissingCategories) {
        warnings.push(`Categoría "${catName}" no existe y create_missing_categories=false`);
        return null;
      }

      if (dryRun) {
        warnings.push(`Se crearía categoría "${catName}"`);
        return null;
      }

      try {
        const createdCat = await this.categoryService.createCategory(
          { name: catName, description: 'Creada por importación masiva' },
          false
        );
        categoryCache.set(key, createdCat.id);
        warnings.push(`Categoría creada: "${catName}"`);
        return createdCat.id;
      } catch (e: any) {
        try {
          const { categories } = await this.categoryService.getAllCategories();
          for (const c of categories) {
            categoryCache.set(c.name.trim().toLowerCase(), c.id);
          }
        } catch {
          /* ignore */
        }
        if (categoryCache.has(key)) {
          return categoryCache.get(key)!;
        }
        warnings.push(`No se pudo crear categoría "${catName}": ${e?.message || e}`);
        return null;
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const warnings: string[] = [];
      const name = String(item.name ?? '').trim();

      if (!name) {
        errors += 1;
        rows.push({
          index: i,
          status: 'error',
          warnings,
          error: 'Falta nombre (único dato obligatorio)'
        });
        continue;
      }

      try {
        const { prices, warnings: priceWarnings, hasAnyPrice } = resolvePrices(item);
        warnings.push(...priceWarnings);

        let code = String(item.code ?? '').trim();
        if (!code) {
          code = nextUniqueCode(name);
          warnings.push(`Código autogenerado: ${code}`);
        } else if (code.length > 20) {
          code = code.slice(0, 20);
          warnings.push('Código truncado a 20 caracteres');
        }

        const categoryId = await resolveCategoryId(item, warnings);
        const stock = toNum(item.stock) ?? 0;
        const minStock = toNum(item.min_stock) ?? 0;
        const maxStock = toNum(item.max_stock) ?? 1000;
        const iva = toNum(item.iva_rate) ?? defaultIva;
        const allowBackorders = item.allow_backorders === true;

        let isActive: boolean;
        if (item.is_active !== undefined && item.is_active !== null) {
          isActive = Boolean(item.is_active);
        } else if (!hasAnyPrice && !activateWithoutPrice) {
          isActive = false;
          warnings.push('Producto inactivo (sin precio)');
        } else if (stock === 0 && !allowBackorders) {
          isActive = false;
          warnings.push('Producto inactivo (stock 0 sin venta por encargo)');
        } else {
          isActive = true;
        }

        const existing = await this.productRepository.findByCode(code);
        if (existing) {
          if (onDuplicate === 'skip') {
            skipped += 1;
            rows.push({
              index: i,
              status: dryRun ? 'would_skip' : 'skipped',
              code,
              name,
              product_id: existing.id,
              category_id: categoryId,
              prices,
              warnings: [...warnings, 'Código ya existe: omitido'],
            });
            continue;
          }

          if (dryRun) {
            updated += 1;
            rows.push({
              index: i,
              status: 'would_update',
              code,
              name,
              product_id: existing.id,
              category_id: categoryId ?? existing.category_id ?? null,
              prices,
              warnings,
            });
            continue;
          }

          const updatedProduct = await this.productService.updateProduct(
            existing.id,
            {
              name,
              description: item.description ?? undefined,
              category_id: categoryId,
              price: Number(prices.venta_local ?? 0),
              prices,
              iva_rate: iva,
              stock,
              min_stock: minStock,
              max_stock: maxStock,
              is_active: isActive,
              allow_backorders: allowBackorders
            },
            false
          );
          updated += 1;
          rows.push({
            index: i,
            status: 'updated',
            code,
            name,
            product_id: updatedProduct.id,
            category_id: updatedProduct.category_id ?? categoryId,
            prices: updatedProduct.prices || prices,
            warnings,
          });
          continue;
        }

        // ensure generated/used code reserved
        existingCodes.add(code);

        if (dryRun) {
          created += 1;
          rows.push({
            index: i,
            status: 'would_create',
            code,
            name,
            category_id: categoryId,
            prices,
            warnings,
          });
          continue;
        }

        const createdProduct: Product = await this.productService.createProduct(
          {
            code,
            name,
            description: item.description ?? null,
            category_id: categoryId,
            price: Number(prices.venta_local ?? 0),
            prices,
            iva_rate: iva,
            stock,
            min_stock: minStock,
            max_stock: maxStock,
            is_active: isActive,
            allow_backorders: allowBackorders
          },
          false
        );

        created += 1;
        rows.push({
          index: i,
          status: 'created',
          code,
          name,
          product_id: createdProduct.id,
          category_id: createdProduct.category_id ?? categoryId,
          prices: createdProduct.prices || prices,
          warnings,
        });
      } catch (e: any) {
        errors += 1;
        rows.push({
          index: i,
          status: 'error',
          name,
          warnings,
          error: e?.message || String(e)
        });
      }
    }

    return {
      dry_run: dryRun,
      total: items.length,
      created,
      updated,
      skipped,
      errors,
      rows
    };
  }
}
