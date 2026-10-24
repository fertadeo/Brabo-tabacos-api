import { ApiResponse } from '../types';
import { ProductPricingRepository } from '../repositories/ProductPricingRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { ArgentinaExchangeRateService } from './ArgentinaExchangeRateService';
import { WooCommerceService } from './WooCommerceService';
import { logger } from '../utils/logger';

export interface CategoryAdjustmentInput {
  category_ids: number[];
  percentage: number;
  include_uncategorized?: boolean;
  active_only?: boolean;
  dry_run?: boolean;
  sync_to_woocommerce?: boolean;
  preview_limit?: number;
}

export interface DollarAdjustmentInput {
  active_only?: boolean;
  dry_run?: boolean;
  sync_to_woocommerce?: boolean;
  preview_limit?: number;
}

export class ProductPricingService {
  private pricingRepository: ProductPricingRepository;
  private categoryRepository: CategoryRepository;
  private exchangeRateService: ArgentinaExchangeRateService;
  private wooCommerceService: WooCommerceService;

  constructor() {
    this.pricingRepository = new ProductPricingRepository();
    this.categoryRepository = new CategoryRepository();
    this.exchangeRateService = new ArgentinaExchangeRateService();
    this.wooCommerceService = new WooCommerceService();
  }

  async getCategoriesForPricing(activeOnly = true) {
    const counts = await this.pricingRepository.getCategoryProductCounts(activeOnly);
    const categories = await this.categoryRepository.findAll();
    const byId = new Map(categories.map((c) => [c.id, c]));

    return counts.map((row) => ({
      category_id: row.category_id,
      category_name: row.category_name,
      product_count: row.product_count,
      is_active: row.category_id == null ? true : (byId.get(row.category_id)?.is_active ?? true)
    }));
  }

  async previewCategoryAdjustment(input: CategoryAdjustmentInput): Promise<ApiResponse> {
    const {
      category_ids,
      percentage,
      include_uncategorized = false,
      active_only = true,
      preview_limit = 10
    } = input;

    if (!Number.isFinite(percentage)) {
      throw new Error('El porcentaje debe ser un número válido');
    }
    if (category_ids.length === 0 && !include_uncategorized) {
      throw new Error('Seleccioná al menos una categoría o incluí productos sin categoría');
    }

    const affected = await this.pricingRepository.countProductsForCategories(
      category_ids,
      include_uncategorized,
      active_only
    );

    const sample = await this.pricingRepository.getPricePreviewSample(preview_limit, {
      categoryIds: category_ids,
      includeUncategorized: include_uncategorized,
      percentage,
      activeOnly: active_only
    });

    return {
      success: true,
      message: 'Vista previa de actualización por categoría',
      data: {
        percentage,
        category_ids,
        include_uncategorized,
        products_affected: affected,
        multiplier: 1 + percentage / 100,
        sample
      },
      timestamp: new Date().toISOString()
    };
  }

  async applyCategoryAdjustment(input: CategoryAdjustmentInput): Promise<ApiResponse> {
    const {
      category_ids,
      percentage,
      include_uncategorized = false,
      active_only = true,
      dry_run = false,
      sync_to_woocommerce = false
    } = input;

    if (category_ids.length === 0 && !include_uncategorized) {
      throw new Error('Seleccioná al menos una categoría o incluí productos sin categoría');
    }

    if (dry_run) {
      return this.previewCategoryAdjustment(input);
    }

    const updated = await this.pricingRepository.applyPercentageByCategories(
      category_ids,
      percentage,
      { includeUncategorized: include_uncategorized, activeOnly: active_only }
    );

    let wooSync: { synced: number; failed: number } | undefined;
    if (sync_to_woocommerce && this.wooCommerceService.isConfigured()) {
      wooSync = await this.syncWooCommercePrices(active_only);
    }

    return {
      success: true,
      message: `Precios actualizados en ${updated} producto(s) (${percentage >= 0 ? '+' : ''}${percentage}%)`,
      data: {
        products_updated: updated,
        percentage,
        category_ids,
        include_uncategorized,
        woocommerce_sync: wooSync
      },
      timestamp: new Date().toISOString()
    };
  }

  async getDollarRateInfo(): Promise<ApiResponse> {
    const quote = await this.exchangeRateService.fetchUsdArsQuote();
    const referenceRate = await this.pricingRepository.getLastUsdArsRate();
    const currentRate = quote.rate;

    const hasReference = referenceRate > 0;
    const multiplier = hasReference ? currentRate / referenceRate : 1;
    const variationPercent = hasReference
      ? ((currentRate - referenceRate) / referenceRate) * 100
      : 0;

    const activeCount = await this.pricingRepository.countActiveProducts(true);

    const sample = hasReference
      ? await this.pricingRepository.getPricePreviewSample(5, {
          dollarMultiplier: multiplier,
          activeOnly: true
        })
      : [];

    return {
      success: true,
      message: hasReference
        ? 'Cotización del dólar y variación respecto a la última actualización'
        : 'Cotización del dólar (sin referencia previa; la primera aplicación solo guardará la cotización)',
      data: {
        quote,
        reference_rate: hasReference ? referenceRate : null,
        current_rate: currentRate,
        variation_percent: Math.round(variationPercent * 100) / 100,
        increment_percent: Math.round(variationPercent * 100) / 100,
        price_multiplier: Math.round(multiplier * 10000) / 10000,
        products_affected_estimate: activeCount,
        is_first_adjustment: !hasReference,
        sample_preview: sample
      },
      timestamp: new Date().toISOString()
    };
  }

  async previewDollarAdjustment(input: DollarAdjustmentInput = {}): Promise<ApiResponse> {
    const info = await this.getDollarRateInfo();
    const data = info.data as Record<string, unknown>;
    const previewLimit = input.preview_limit ?? 10;
    const multiplier = Number(data.price_multiplier) || 1;

    const sample = await this.pricingRepository.getPricePreviewSample(previewLimit, {
      dollarMultiplier: multiplier,
      activeOnly: input.active_only !== false
    });

    return {
      success: true,
      message: 'Vista previa de ajuste por variación del dólar',
      data: {
        ...data,
        sample_preview: sample
      },
      timestamp: new Date().toISOString()
    };
  }

  async applyDollarAdjustment(input: DollarAdjustmentInput = {}): Promise<ApiResponse> {
    const {
      active_only = true,
      dry_run = false,
      sync_to_woocommerce = false
    } = input;

    const quote = await this.exchangeRateService.fetchUsdArsQuote();
    const currentRate = quote.rate;
    const referenceRate = await this.pricingRepository.getLastUsdArsRate();

    if (dry_run) {
      return this.previewDollarAdjustment(input);
    }

    if (referenceRate <= 0) {
      await this.pricingRepository.setLastUsdArsRate(currentRate);
      return {
        success: true,
        message:
          'Referencia de cotización inicial guardada. No se modificaron precios. Al próximo cambio del dólar podrás aplicar el ajuste.',
        data: {
          quote,
          reference_rate_set: currentRate,
          products_updated: 0,
          variation_percent: 0,
          is_first_adjustment: true
        },
        timestamp: new Date().toISOString()
      };
    }

    const multiplier = currentRate / referenceRate;
    const variationPercent = ((currentRate - referenceRate) / referenceRate) * 100;

    if (Math.abs(variationPercent) < 0.0001) {
      return {
        success: true,
        message: 'No hay variación significativa en la cotización; los precios no se modificaron',
        data: {
          quote,
          reference_rate: referenceRate,
          current_rate: currentRate,
          variation_percent: 0,
          products_updated: 0
        },
        timestamp: new Date().toISOString()
      };
    }

    const updated = await this.pricingRepository.applyDollarMultiplier(multiplier, active_only);
    await this.pricingRepository.setLastUsdArsRate(currentRate);

    let wooSync: { synced: number; failed: number } | undefined;
    if (sync_to_woocommerce && this.wooCommerceService.isConfigured()) {
      wooSync = await this.syncWooCommercePrices(active_only);
    }

    return {
      success: true,
      message: `Precios ajustados por variación del dólar (${variationPercent >= 0 ? '+' : ''}${variationPercent.toFixed(2)}%) en ${updated} producto(s)`,
      data: {
        quote,
        reference_rate: referenceRate,
        current_rate: currentRate,
        variation_percent: Math.round(variationPercent * 100) / 100,
        increment_percent: Math.round(variationPercent * 100) / 100,
        price_multiplier: Math.round(multiplier * 10000) / 10000,
        products_updated: updated,
        new_reference_rate: currentRate,
        woocommerce_sync: wooSync
      },
      timestamp: new Date().toISOString()
    };
  }

  private async syncWooCommercePrices(activeOnly: boolean): Promise<{ synced: number; failed: number }> {
    const linked = await this.pricingRepository.findLinkedProductsForWooSync(activeOnly);
    let synced = 0;
    let failed = 0;
    const batchSize = 5;

    for (let i = 0; i < linked.length; i += batchSize) {
      const batch = linked.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((p) =>
          this.wooCommerceService.updateProduct(p.woocommerce_id, {
            regular_price: String(p.price)
          })
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') synced += 1;
        else failed += 1;
      });
      if (i + batchSize < linked.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (failed > 0) {
      logger.product.error(`Sync WooCommerce tras ajuste de precios: ${synced} ok, ${failed} error(es)`);
    }

    return { synced, failed };
  }
}
