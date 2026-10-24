import axios from 'axios';
import { ProductProvider, ProductResult, BarcodeSearchOptions } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Provider para UPCItemDB API
 * Documentación: https://www.upcitemdb.com/api
 */
export const upcProvider: ProductProvider = {
  name: 'upcitemdb',
  
  async search(barcode: string, _options?: BarcodeSearchOptions): Promise<ProductResult | null> {
    try {
      const cleanedBarcode = barcode.replace(/[\s-]/g, '');
      if (!/^\d+$/.test(cleanedBarcode) || cleanedBarcode.length < 8) {
        return null;
      }

      const response = await axios.get(
        `https://api.upcitemdb.com/prod/trial/lookup`,
        {
          params: {
            upc: cleanedBarcode
          },
          timeout: 5000 // 5 segundos de timeout
        }
      );

      // La API retorna { code: "OK", offset: 0, total: 1, items: [...] }
      if (response.data?.code === 'OK' && response.data?.items?.length > 0) {
        const item = response.data.items[0];
        
        return {
          title: item.title || item.description || 'Producto sin nombre',
          description: item.description || undefined,
          brand: item.brand || undefined,
          images: item.images && Array.isArray(item.images) ? item.images : undefined,
          source: 'upcitemdb',
          suggested_price: item.lowest_recorded_price || item.highest_recorded_price || undefined,
          category_suggestion: item.category || undefined
        };
      }

      return null;
    } catch (error: any) {
      logger.barcode.provider(`upcitemdb: error → ${error.message}`);
      return null;
    }
  }
};
